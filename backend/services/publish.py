import os
import re
import json
import csv
import glob
import shutil
import io
from sqlalchemy.orm import Session

from models import Category, Translation, GenerationImage, PublishRun, PublishedFile
from services.content_variants import ensure_content_variant

OUTPUT_DIR = "output"
PUBLISH_DIR = "publish"


def slugify(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"[^\w\-]", "", text, flags=re.UNICODE)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def _variation_number_from_path(path: str) -> int:
    match = re.search(r"_v(\d+)\.png$", path)
    return int(match.group(1)) if match else 0


def _get_generated_files(category_id: int, subject_name: str) -> list[str]:
    category_dir = os.path.join(OUTPUT_DIR, str(category_id))
    pattern = os.path.join(category_dir, f"{subject_name.lower().replace(' ', '_')}_v*.png")
    return sorted(glob.glob(pattern), key=_variation_number_from_path)


def _variation_text_for_number(variations_sorted: list, variation_number: int) -> str:
    if not variations_sorted:
        return ""
    idx = (variation_number - 1) % len(variations_sorted)
    return variations_sorted[idx].text


def _already_published_source_paths(db: Session, category_name: str, lang: str) -> set[str]:
    """Every source_path that has appeared in any past publish run for this
    category+language, across all runs — used to mark files as new vs repeat."""
    rows = (
        db.query(PublishedFile.source_path)
        .join(PublishRun, PublishedFile.run_id == PublishRun.id)
        .filter(PublishRun.category == category_name, PublishRun.lang == lang)
        .all()
    )
    return {r[0] for r in rows}


def build_publish_plan(db: Session, category_name: str, lang: str, only_new: bool = False) -> dict:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

    translation = (
        db.query(Translation)
        .filter(Translation.category_id == category.id, Translation.lang == lang)
        .first()
    )
    if not translation:
        raise ValueError(f"No '{lang}' translation exists for category '{category_name}'")

    subject_map = {}
    for item in translation.items:
        subject_map[item.subject.name] = item.translated_text

    variation_map = {}
    for item in translation.variation_items:
        variation_map[item.variation.text] = item.translated_text

    variations_sorted = sorted(category.variations, key=lambda v: v.order)
    already_published = _already_published_source_paths(db, category_name, lang)

    files_info = []
    skipped_subjects = []

    for subject in category.subjects:
        translated_subject = subject_map.get(subject.name)
        if not translated_subject:
            skipped_subjects.append(subject.name)
            continue

        source_files = _get_generated_files(category.id, subject.name)
        for source_path in source_files:
            variation_number = _variation_number_from_path(source_path)

            recorded = (
                db.query(GenerationImage)
                .filter(GenerationImage.file_path == source_path)
                .first()
            )
            if recorded and recorded.variation_text:
                variation_text_en = recorded.variation_text
            else:
                variation_text_en = _variation_text_for_number(variations_sorted, variation_number)

            translated_variant = variation_map.get(variation_text_en, "")

            name_raw = translation.filename_template.format(
                category=translation.category_translated,
                item=translated_subject,
                variant="",
            )
            base_slug = slugify(name_raw)
            target_filename = f"{base_slug}-{variation_number}.png"

            alt_text = translation.alt_template.format(
                category=translation.category_translated,
                item=translated_subject,
                variant=translated_variant,
            )
            title_text = translation.title_template.format(
                category=translation.category_translated,
                item=translated_subject,
                variant=translated_variant,
            )

            files_info.append({
                "source_path": source_path,
                "target_filename": target_filename,
                "alt_text": alt_text,
                "title_text": title_text,
                "subject_en": subject.name,
                "subject_translated": translated_subject,
                "variation_text_en": variation_text_en,
                "variation_translated": translated_variant or None,
                "variation_number": variation_number,
                "is_new": source_path not in already_published,
            })

    new_count = sum(1 for f in files_info if f["is_new"])
    already_count = len(files_info) - new_count

    if only_new:
        files_info = [f for f in files_info if f["is_new"]]

    return {
        "files": files_info,
        "skipped_subjects": skipped_subjects,
        "new_count": new_count,
        "already_published_count": already_count,
    }


def execute_publish(db: Session, category_name: str, lang: str, only_new: bool = False) -> dict:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

    plan = build_publish_plan(db, category_name, lang, only_new=only_new)
    files_info = plan["files"]

    publish_category_dir = os.path.join(PUBLISH_DIR, lang, category_name)
    os.makedirs(publish_category_dir, exist_ok=True)

    rows = []
    for info in files_info:
        # Prefer real, natural-language SEO content (same source WordPress
        # push uses, cached and shared) — fall back to the mechanical
        # template text for legacy images that predate variation tracking,
        # so local publish never hard-fails the way WordPress push does.
        alt_text = info["alt_text"]
        title_text = info["title_text"]
        excerpt_text = ""
        content_text = ""

        image_record = db.query(GenerationImage).filter(GenerationImage.file_path == info["source_path"]).first()
        if image_record and image_record.variation_text:
            try:
                variant = ensure_content_variant(
                    db,
                    category_id=category.id,
                    subject_name=image_record.subject,
                    variation_text=image_record.variation_text,
                    lang=lang,
                )
                alt_text = variant.seo_alt_text
                title_text = variant.seo_title
                excerpt_text = variant.seo_excerpt
                content_text = variant.seo_content
            except Exception:
                pass  # fall back silently to mechanical text on any generation failure

        target_path = os.path.join(publish_category_dir, info["target_filename"])
        shutil.copy2(info["source_path"], target_path)
        rows.append({
            "filename": info["target_filename"],
            "alt_text": alt_text,
            "title": title_text,
            "excerpt": excerpt_text,
            "content": content_text,
            "category_en": category_name,
            "subject_en": info["subject_en"],
            "subject_translated": info["subject_translated"],
            "variation_en": info["variation_text_en"],
            "variation_translated": info["variation_translated"] or "",
            "source_path": info["source_path"],
        })

    manifest_path = os.path.join(publish_category_dir, "manifest.csv")
    if rows:
        with open(manifest_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)

    # Record this run permanently, so future plans know what's already published
    # and the UI can show a real history rather than a one-off return value.
    run = PublishRun(
        category=category_name,
        lang=lang,
        published_count=len(files_info),
        new_count=plan["new_count"],
        already_published_count=plan["already_published_count"],
        skipped_subjects_json=json.dumps(plan["skipped_subjects"]),
        manifest_path=manifest_path,
    )
    db.add(run)
    db.flush()

    for info, row in zip(files_info, rows):
        db.add(PublishedFile(
            run_id=run.id,
            source_path=info["source_path"],
            target_filename=info["target_filename"],
            alt_text=row["alt_text"],
            title_text=row["title"],
            excerpt_text=row["excerpt"],
            content_text=row["content"],
            was_new=info["is_new"],
        ))

    db.commit()

    return {
        "published_count": len(rows),
        "new_count": plan["new_count"],
        "already_published_count": plan["already_published_count"],
        "manifest_path": manifest_path,
        "skipped_subjects": plan["skipped_subjects"],
        "run_id": run.id,
    }


def get_publish_history(db: Session, category_name: str, lang: str | None = None) -> list[PublishRun]:
    query = db.query(PublishRun).filter(PublishRun.category == category_name)
    if lang:
        query = query.filter(PublishRun.lang == lang)
    return query.order_by(PublishRun.created_at.desc()).all()


def generate_manifest_csv(db: Session, run_id: int) -> str:
    """Builds manifest CSV content from a PublishRun's stored PublishedFile
    rows — works even if the on-disk manifest.csv has since been overwritten
    by a later run."""
    run = db.query(PublishRun).filter(PublishRun.id == run_id).first()
    if not run:
        raise ValueError(f"Publish run {run_id} not found")

    output = io.StringIO()
    fieldnames = ["filename", "alt_text", "title", "excerpt", "content", "category_en", "lang", "source_path"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for f in run.files:
        writer.writerow({
            "filename": f.target_filename,
            "alt_text": f.alt_text,
            "title": f.title_text,
            "excerpt": f.excerpt_text or "",
            "content": f.content_text or "",
            "category_en": run.category,
            "lang": run.lang,
            "source_path": f.source_path,
        })

    return "\ufeff" + output.getvalue()
