import os
import httpx
from sqlalchemy.orm import Session
from models import Category, Translation
from services.publish import build_publish_plan

from models import WordPressIntegration, WordPressCategoryTerm, WordPressPublishedItem


def _get_wp_config(db: Session) -> WordPressIntegration:
    config = db.query(WordPressIntegration).filter(WordPressIntegration.id == 1).first()
    if not config or not config.site_url or not config.username or not config.app_password:
        raise ValueError("WordPress is not fully configured. Set it up in Settings first.")
    return config


def _auth(config: WordPressIntegration) -> tuple[str, str]:
    return (config.username, config.app_password)


TAXONOMY_REST_BASE = {"category": "categories", "post_tag": "tags"}
POST_TYPE_REST_BASE = {"post": "posts", "page": "pages"}


def ensure_category_term(db: Session, config: WordPressIntegration, category: str, lang: str, translated_name: str) -> int:
    """Returns the WP term ID for this category+language, creating it on
    WordPress only the first time it's ever needed."""
    existing = (
        db.query(WordPressCategoryTerm)
        .filter(WordPressCategoryTerm.category == category, WordPressCategoryTerm.lang == lang)
        .first()
    )
    if existing:
        return existing.wp_term_id

    rest_base = TAXONOMY_REST_BASE.get(config.taxonomy, config.taxonomy)
    url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/{rest_base}"
    response = httpx.post(url, auth=_auth(config), json={"name": translated_name}, timeout=15.0)

    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to create taxonomy term '{translated_name}': {response.status_code} {response.text}")

    term_id = response.json()["id"]

    record = WordPressCategoryTerm(category=category, lang=lang, wp_term_id=term_id)
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

    # Set alt text + title on the media item itself (a second call —
    # the initial upload doesn't accept these fields directly)
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
    lang: str | None = None,
    translations_link: dict | None = None,
) -> dict:
    post_rest_base = POST_TYPE_REST_BASE.get(config.post_type, config.post_type)
    url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/{post_rest_base}"

    # Built-in WordPress taxonomies use fixed REST field names that differ
    # from their taxonomy slug; custom taxonomies use their own slug directly.
    taxonomy_field = TAXONOMY_REST_BASE.get(config.taxonomy, config.taxonomy)

    payload: dict = {
        "title": title,
        "status": status,
        "featured_media": media_id,
        taxonomy_field: [term_id],
    }

    if lang:
        payload["lang"] = lang
    if translations_link:
        payload["translations"] = translations_link

    response = httpx.post(url, auth=_auth(config), json=payload, timeout=20.0)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Failed to create post '{title}': {response.status_code} {response.text}")

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
) -> WordPressPublishedItem:
    record = WordPressPublishedItem(
        source_path=source_path,
        category=category,
        lang=lang,
        wp_media_id=wp_media_id,
        wp_post_id=wp_post_id,
        wp_post_url=wp_post_url,
        status=status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_already_pushed_paths(db: Session, category: str, lang: str) -> set[str]:
    """Every source_path already pushed for this category+language —
    used to compute the 'only new' filter for a WordPress publish run."""
    rows = (
        db.query(WordPressPublishedItem.source_path)
        .filter(WordPressPublishedItem.category == category, WordPressPublishedItem.lang == lang)
        .all()
    )
    return {r[0] for r in rows}

def push_batch_to_wordpress(
    db: Session,
    category_name: str,
    lang: str,
    status: str = "draft",
    only_new: bool = True,
) -> dict:
    """The main entry point: pushes a category's images, in one language,
    to WordPress — reusing the same translated alt/title text already
    computed for local publish, so there's exactly one source of truth
    for what an image's metadata should say in a given language."""
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
    all_files = plan["files"]

    already_pushed = get_already_pushed_paths(db, category_name, lang)
    files_to_push = [f for f in all_files if f["source_path"] not in already_pushed] if only_new else all_files
    skipped_count = len(all_files) - len(files_to_push)

    term_id = ensure_category_term(db, config, category_name, lang, translation.category_translated)

    pushed_items = []
    failed_items = []

    for f in files_to_push:
        try:
            filename = os.path.basename(f["source_path"])
            media_id = upload_media(
                config,
                file_path=f["source_path"],
                filename=filename,
                alt_text=f["alt_text"],
                title=f["title_text"],
            )
            result = create_post(
                config,
                title=f["title_text"],
                media_id=media_id,
                term_id=term_id,
                status=status,
                lang=None,  # Polylang lang/translations linking deferred until Pro is confirmed
            )
            record = record_published_item(
                db,
                source_path=f["source_path"],
                category=category_name,
                lang=lang,
                wp_media_id=media_id,
                wp_post_id=result["id"],
                wp_post_url=result.get("link", ""),
                status=status,
            )
            pushed_items.append({
                "source_path": f["source_path"],
                "wp_post_id": result["id"],
                "wp_post_url": result.get("link", ""),
                "title": f["title_text"],
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

def push_batch_to_wordpress(
    db: Session,
    category_name: str,
    lang: str,
    status: str = "draft",
    only_new: bool = True,
) -> dict:
    """The main entry point: pushes a category's images, in one language,
    to WordPress — reusing the same translated alt/title text already
    computed for local publish, so there's exactly one source of truth
    for what an image's metadata should say in a given language."""
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
    all_files = plan["files"]

    already_pushed = get_already_pushed_paths(db, category_name, lang)
    files_to_push = [f for f in all_files if f["source_path"] not in already_pushed] if only_new else all_files
    skipped_count = len(all_files) - len(files_to_push)

    term_id = ensure_category_term(db, config, category_name, lang, translation.category_translated)

    pushed_items = []
    failed_items = []

    for f in files_to_push:
        try:
            filename = os.path.basename(f["source_path"])
            media_id = upload_media(
                config,
                file_path=f["source_path"],
                filename=filename,
                alt_text=f["alt_text"],
                title=f["title_text"],
            )
            result = create_post(
                config,
                title=f["title_text"],
                media_id=media_id,
                term_id=term_id,
                status=status,
                lang=None,  # Polylang lang/translations linking deferred until Pro is confirmed
            )
            record = record_published_item(
                db,
                source_path=f["source_path"],
                category=category_name,
                lang=lang,
                wp_media_id=media_id,
                wp_post_id=result["id"],
                wp_post_url=result.get("link", ""),
                status=status,
            )
            pushed_items.append({
                "source_path": f["source_path"],
                "wp_post_id": result["id"],
                "wp_post_url": result.get("link", ""),
                "title": f["title_text"],
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