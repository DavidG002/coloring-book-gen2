import os
import httpx
from sqlalchemy.orm import Session
from models import Category, Translation
from services.publish import build_publish_plan, slugify
from services.content_variants import ensure_content_variant, ensure_category_description

from models import (
    WordPressIntegration, WordPressCategoryTerm, WordPressPublishedItem,
    GenerationImage, PublishedFile, PublishRun,
)


def _get_wp_config(db: Session) -> WordPressIntegration:
    config = db.query(WordPressIntegration).filter(WordPressIntegration.id == 1).first()
    if not config or not config.site_url or not config.username or not config.app_password:
        raise ValueError("WordPress is not fully configured. Set it up in Settings first.")
    return config


def _auth(config: WordPressIntegration) -> tuple[str, str]:
    return (config.username, config.app_password)


TAXONOMY_REST_BASE = {"category": "categories", "post_tag": "tags"}
POST_TYPE_REST_BASE = {"post": "posts", "page": "pages"}


def get_sibling_translations(db: Session, source_path: str, exclude_lang: str, site_url: str) -> dict[str, int]:
    """Finds every other language's WP post ID for this same image, on this
    same site, so a newly-created post can be linked to them via Polylang's
    translations field. Returns {lang: wp_post_id}."""
    rows = (
        db.query(WordPressPublishedItem.lang, WordPressPublishedItem.wp_post_id)
        .filter(
            WordPressPublishedItem.source_path == source_path,
            WordPressPublishedItem.lang != exclude_lang,
            WordPressPublishedItem.site_url == site_url,
        )
        .all()
    )
    return {lang: post_id for lang, post_id in rows}


def get_sibling_term_translations(db: Session, category: str, exclude_lang: str, site_url: str) -> dict[str, int]:
    """Same idea, for the category's taxonomy term across languages, on this same site."""
    rows = (
        db.query(WordPressCategoryTerm.lang, WordPressCategoryTerm.wp_term_id)
        .filter(
            WordPressCategoryTerm.category == category,
            WordPressCategoryTerm.lang != exclude_lang,
            WordPressCategoryTerm.site_url == site_url,
        )
        .all()
    )
    return {lang: term_id for lang, term_id in rows}


def ensure_category_term(
    db: Session,
    config: WordPressIntegration,
    category: str,
    lang: str,
    translated_name: str,
    description: str | None = None,
) -> int:
    """Returns the WP term ID for this category+language+site, creating it on
    WordPress only the first time it's ever needed for this specific site.
    If Polylang Pro linking is enabled, links a newly-created term to any
    sibling terms that already exist for this category in other languages
    on this same site."""
    existing = (
        db.query(WordPressCategoryTerm)
        .filter(
            WordPressCategoryTerm.category == category,
            WordPressCategoryTerm.lang == lang,
            WordPressCategoryTerm.site_url == config.site_url,
        )
        .first()
    )
    if existing:
        return existing.wp_term_id

    rest_base = TAXONOMY_REST_BASE.get(config.taxonomy, config.taxonomy)
    url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/{rest_base}"

    payload = {"name": translated_name}
    if description:
        payload["description"] = description

    if config.use_polylang_linking:
        payload["lang"] = lang
        siblings = get_sibling_term_translations(db, category, exclude_lang=lang, site_url=config.site_url)
        if siblings:
            payload["translations"] = siblings

    response = httpx.post(url, auth=_auth(config), json=payload, timeout=15.0)

    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to create taxonomy term '{translated_name}': {response.status_code} {response.text}")

    term_id = response.json()["id"]

    record = WordPressCategoryTerm(category=category, lang=lang, wp_term_id=term_id, site_url=config.site_url)
    db.add(record)
    db.commit()
    return term_id


def upload_media(config: WordPressIntegration, file_path: str, filename: str, alt_text: str, title: str) -> int:
    """Uploads one image to the WP Media Library, returns its media ID."""
    url = config.site_url.rstrip("/") + "/wp-json/wp/v2/media"

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    files = {"file": (filename, file_bytes, "image/png")}

    response = httpx.post(url, auth=_auth(config), headers=headers, files=files, timeout=30.0)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to upload media '{filename}': {response.status_code} {response.text}")

    media_id = response.json()["id"]

    update_url = f"{url}/{media_id}"
    httpx.post(
        update_url,
        auth=_auth(config),
        json={"alt_text": alt_text, "title": title},
        timeout=15.0,
    )

    return media_id


def create_post(
    config: WordPressIntegration,
    title: str,
    media_id: int,
    term_id: int,
    status: str,
    content: str | None = None,
    excerpt: str | None = None,
    slug: str | None = None,
    lang: str | None = None,
    translations_link: dict | None = None,
) -> dict:
    post_rest_base = POST_TYPE_REST_BASE.get(config.post_type, config.post_type)
    url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/{post_rest_base}"

    taxonomy_field = TAXONOMY_REST_BASE.get(config.taxonomy, config.taxonomy)

    payload: dict = {
        "title": title,
        "status": status,
        "featured_media": media_id,
        taxonomy_field: [term_id],
    }

    if content:
        payload["content"] = content
    if excerpt:
        payload["excerpt"] = excerpt
    if slug:
        payload["slug"] = slug
    if lang:
        payload["lang"] = lang
    if translations_link:
        payload["translations"] = translations_link

    response = httpx.post(url, auth=_auth(config), json=payload, timeout=20.0)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to create post '{title}': {response.status_code} {response.text}")

    return response.json()


def update_post(config: WordPressIntegration, wp_post_id: int, title: str, content: str, excerpt: str) -> dict:
    """Pushes fresh content to an already-existing WordPress post."""
    post_rest_base = POST_TYPE_REST_BASE.get(config.post_type, config.post_type)
    url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/{post_rest_base}/{wp_post_id}"

    payload = {"title": title, "content": content, "excerpt": excerpt}
    response = httpx.post(url, auth=_auth(config), json=payload, timeout=20.0)

    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to update post {wp_post_id}: {response.status_code} {response.text}")

    return response.json()


def update_media_alt_text(config: WordPressIntegration, wp_media_id: int, alt_text: str, title: str) -> dict:
    """Pushes fresh alt text/title to an already-existing media item."""
    url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/media/{wp_media_id}"

    response = httpx.post(url, auth=_auth(config), json={"alt_text": alt_text, "title": title}, timeout=15.0)

    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to update media {wp_media_id}: {response.status_code} {response.text}")

    return response.json()


def record_published_item(
    db: Session,
    source_path: str,
    category: str,
    lang: str,
    wp_media_id: int,
    wp_post_id: int,
    wp_post_url: str,
    status: str,
    site_url: str,
    title: str = "",
    alt_text: str = "",
    excerpt: str = "",
    content: str = "",
) -> WordPressPublishedItem:
    record = WordPressPublishedItem(
        source_path=source_path,
        category=category,
        lang=lang,
        wp_media_id=wp_media_id,
        wp_post_id=wp_post_id,
        wp_post_url=wp_post_url,
        status=status,
        site_url=site_url,
        pushed_title=title,
        pushed_alt_text=alt_text,
        pushed_excerpt=excerpt,
        pushed_content=content,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_already_pushed_paths(db: Session, category: str, lang: str, site_url: str) -> set[str]:
    """Every source_path already pushed for this category+language, on this
    specific site — used to compute the 'only new' filter."""
    rows = (
        db.query(WordPressPublishedItem.source_path)
        .filter(
            WordPressPublishedItem.category == category,
            WordPressPublishedItem.lang == lang,
            WordPressPublishedItem.site_url == site_url,
        )
        .all()
    )
    return {r[0] for r in rows}


def get_locally_published_paths(db: Session, category: str, lang: str) -> set[str]:
    """Only files that have actually gone through a local Publish run for
    this category+language are eligible for WordPress — this is the real
    approval gate: reviewed, translated, and deliberately confirmed. Not
    site-scoped, since local Publish is independent of which WP site."""
    rows = (
        db.query(PublishedFile.source_path)
        .join(PublishRun, PublishedFile.run_id == PublishRun.id)
        .filter(PublishRun.category == category, PublishRun.lang == lang)
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def preview_wordpress_push(db: Session, category_name: str, lang: str) -> dict:
    """Shows every locally-published-and-eligible file for this category+
    language — each tagged with push status (for the currently configured
    site), exclusion status, whether it needs re-syncing, and which local
    publish run it came from."""
    config = _get_wp_config(db)

    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

    translation = (
        db.query(Translation)
        .filter(Translation.category_id == category.id, Translation.lang == lang)
        .first()
    )
    if not translation:
        raise ValueError(f"No '{lang}' translation for '{category_name}' — create it first")

    plan = build_publish_plan(db, category_name, lang)
    already_pushed = get_already_pushed_paths(db, category_name, lang, site_url=config.site_url)
    locally_published = get_locally_published_paths(db, category_name, lang)
    eligible_files = [f for f in plan["files"] if f["source_path"] in locally_published]

    existing_term = (
        db.query(WordPressCategoryTerm)
        .filter(
            WordPressCategoryTerm.category == category_name,
            WordPressCategoryTerm.lang == lang,
            WordPressCategoryTerm.site_url == config.site_url,
        )
        .first()
    )

    files_info = []
    for f in eligible_files:
        image_record = db.query(GenerationImage).filter(GenerationImage.file_path == f["source_path"]).first()

        pushed_item = (
            db.query(WordPressPublishedItem)
            .filter(
                WordPressPublishedItem.source_path == f["source_path"],
                WordPressPublishedItem.lang == lang,
                WordPressPublishedItem.site_url == config.site_url,
            )
            .first()
        )

        publish_file_record = (
            db.query(PublishedFile)
            .join(PublishRun, PublishedFile.run_id == PublishRun.id)
            .filter(
                PublishedFile.source_path == f["source_path"],
                PublishRun.category == category_name,
                PublishRun.lang == lang,
            )
            .order_by(PublishRun.created_at.asc())
            .first()
        )

        seo_error = None
        needs_update = False
        display_title = f["title_text"]
        display_alt = f["alt_text"]
        if image_record and image_record.variation_text:
            try:
                variant = ensure_content_variant(
                    db,
                    category_name=category_name,
                    subject_name=image_record.subject,
                    variation_text=image_record.variation_text,
                    lang=lang,
                )
                display_title = variant.seo_title
                display_alt = variant.seo_alt_text
                if pushed_item:
                    needs_update = (
                        variant.seo_title != (pushed_item.pushed_title or "")
                        or variant.seo_alt_text != (pushed_item.pushed_alt_text or "")
                        or variant.seo_excerpt != (pushed_item.pushed_excerpt or "")
                        or variant.seo_content != (pushed_item.pushed_content or "")
                    )
            except Exception as e:
                seo_error = str(e)
        else:
            seo_error = "Missing subject/variation data — this image predates SEO content tracking and cannot be pushed."

        files_info.append({
            "source_path": f["source_path"],
            "title": display_title,
            "alt_text": display_alt,
            "already_pushed": f["source_path"] in already_pushed,
            "wp_excluded": image_record.wp_excluded if image_record else False,
            "publish_run_id": publish_file_record.run_id if publish_file_record else None,
            "published_at": publish_file_record.run.created_at.isoformat() if publish_file_record else None,
            "seo_error": seo_error,
            "needs_update": needs_update,
        })

    new_count = sum(1 for f in files_info if not f["already_pushed"])

    return {
        "new_count": new_count,
        "already_pushed_count": len(files_info) - new_count,
        "term_already_exists": bool(existing_term),
        "category_translated": translation.category_translated,
        "files": files_info,
        "skipped_subjects": plan["skipped_subjects"],
    }


def push_batch_to_wordpress(
    db: Session,
    category_name: str,
    lang: str,
    status: str = "draft",
    only_new: bool = True,
    source_paths: list[str] | None = None,
) -> dict:
    """The main entry point: pushes a category's images, in one language, to
    WordPress — reusing the same translated/SEO content already computed
    for local publish. Only files that have gone through a local Publish
    run are eligible. All tracking (already-pushed, siblings, term reuse)
    is scoped to the currently configured site."""
    config = _get_wp_config(db)

    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

    translation = (
        db.query(Translation)
        .filter(Translation.category_id == category.id, Translation.lang == lang)
        .first()
    )
    if not translation:
        raise ValueError(f"No '{lang}' translation for '{category_name}' — create it first")

    plan = build_publish_plan(db, category_name, lang)
    already_pushed = get_already_pushed_paths(db, category_name, lang, site_url=config.site_url)
    excluded_paths = {
        img.file_path for img in db.query(GenerationImage).filter(GenerationImage.wp_excluded == True).all()
    }
    locally_published = get_locally_published_paths(db, category_name, lang)

    all_files = [f for f in plan["files"] if f["source_path"] in locally_published]

    if source_paths is not None:
        selected = set(source_paths)
        files_to_push = [
            f for f in all_files
            if f["source_path"] in selected
            and f["source_path"] not in already_pushed
            and f["source_path"] not in excluded_paths
        ]
        skipped_count = len(selected) - len(files_to_push)
    else:
        files_to_push = [
            f for f in all_files
            if f["source_path"] not in already_pushed and f["source_path"] not in excluded_paths
        ] if only_new else all_files
        skipped_count = len(all_files) - len(files_to_push)

    category_description = ensure_category_description(db, category_name, translation.category_translated, lang)
    term_id = ensure_category_term(db, config, category_name, lang, translation.category_translated, description=category_description)

    pushed_items = []
    failed_items = []

    for f in files_to_push:
        try:
            image_record = db.query(GenerationImage).filter(GenerationImage.file_path == f["source_path"]).first()
            if not image_record or not image_record.variation_text:
                raise ValueError("Missing subject/variation record for this image — cannot generate SEO content.")

            variant = ensure_content_variant(
                db,
                category_name=category_name,
                subject_name=image_record.subject,
                variation_text=image_record.variation_text,
                lang=lang,
            )

            filename = os.path.basename(f["source_path"])
            media_id = upload_media(
                config,
                file_path=f["source_path"],
                filename=filename,
                alt_text=variant.seo_alt_text,
                title=variant.seo_title,
            )

            post_lang = None
            post_translations = None
            if config.use_polylang_linking:
                post_lang = lang
                siblings = get_sibling_translations(db, f["source_path"], exclude_lang=lang, site_url=config.site_url)
                if siblings:
                    post_translations = siblings

            result = create_post(
                config,
                title=variant.seo_title,
                media_id=media_id,
                term_id=term_id,
                status=status,
                content=variant.seo_content,
                excerpt=variant.seo_excerpt,
                slug=slugify(variant.seo_title),
                lang=post_lang,
                translations_link=post_translations,
            )

            record_published_item(
                db,
                source_path=f["source_path"],
                category=category_name,
                lang=lang,
                wp_media_id=media_id,
                wp_post_id=result["id"],
                wp_post_url=result.get("link", ""),
                status=status,
                site_url=config.site_url,
                title=variant.seo_title,
                alt_text=variant.seo_alt_text,
                excerpt=variant.seo_excerpt,
                content=variant.seo_content,
            )
            pushed_items.append({
                "source_path": f["source_path"],
                "wp_post_id": result["id"],
                "wp_post_url": result.get("link", ""),
                "title": variant.seo_title,
            })
        except Exception as e:
            failed_items.append({"source_path": f["source_path"], "error": str(e)})

    return {
        "pushed_count": len(pushed_items),
        "skipped_count": skipped_count,
        "failed_count": len(failed_items),
        "pushed_items": pushed_items,
        "failed_items": failed_items,
        "skipped_subjects": plan["skipped_subjects"],
    }


def sync_pushed_item_to_wordpress(db: Session, source_path: str, lang: str) -> dict:
    """Re-syncs an already-pushed WordPress post + media with whatever
    content currently exists locally (e.g. after a Regenerate), for the
    currently configured site."""
    config = _get_wp_config(db)

    item = (
        db.query(WordPressPublishedItem)
        .filter(
            WordPressPublishedItem.source_path == source_path,
            WordPressPublishedItem.lang == lang,
            WordPressPublishedItem.site_url == config.site_url,
        )
        .first()
    )
    if not item:
        raise ValueError("This image hasn't been pushed to WordPress yet (on this site) — nothing to sync.")

    image_record = db.query(GenerationImage).filter(GenerationImage.file_path == source_path).first()
    if not image_record or not image_record.variation_text:
        raise ValueError("Missing subject/variation data for this image.")

    category = db.query(Category).filter(Category.name == item.category).first()
    if not category:
        raise ValueError(f"Category '{item.category}' not found")

    variant = ensure_content_variant(
        db,
        category_name=item.category,
        subject_name=image_record.subject,
        variation_text=image_record.variation_text,
        lang=lang,
    )

    update_post(config, item.wp_post_id, variant.seo_title, variant.seo_content, variant.seo_excerpt)
    update_media_alt_text(config, item.wp_media_id, variant.seo_alt_text, variant.seo_title)

    item.pushed_title = variant.seo_title
    item.pushed_alt_text = variant.seo_alt_text
    item.pushed_excerpt = variant.seo_excerpt
    item.pushed_content = variant.seo_content
    db.commit()

    return {
        "wp_post_id": item.wp_post_id,
        "wp_post_url": item.wp_post_url,
        "title": variant.seo_title,
    }