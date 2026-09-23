import os
import shutil
from sqlalchemy.orm import Session

from models import GenerationImage, GenerationJob

OUTPUT_DIR = "output"
REJECTED_SUBDIR = "_rejected"


def get_images_for_job(db: Session, job_id: int) -> list[GenerationImage]:
    return (
        db.query(GenerationImage)
        .filter(GenerationImage.job_id == job_id)
        .order_by(GenerationImage.id)
        .all()
    )

def get_images_for_category(db: Session, category_id: int) -> list[dict]:
    """Every real generated image for this category, oldest first, with its
    actual local-publish and WordPress status — a real pipeline snapshot,
    not just the raw file. WordPress status reflects whether it's been
    pushed in ANY language, and prefers 'publish' over 'draft' if pushed
    in multiple languages with different statuses.

    Uses category_id (not the name string) to identify the real images —
    since category names are only unique per-Book, not globally, filtering
    by name alone could return another Book's same-named category's images."""
    from models import GenerationImage, PublishedFile, WordPressPublishedItem

    images = (
        db.query(GenerationImage)
        .filter(GenerationImage.category_id == category_id)
        .order_by(GenerationImage.created_at.asc())
        .all()
    )
    image_file_paths = {img.file_path for img in images}

    # Scoped to exactly this category's real image file paths — not
    # re-filtered by the ambiguous name string, which would silently
    # reintroduce the same cross-Book mixing bug for these two checks.
    published_paths = {
        p.source_path
        for p in db.query(PublishedFile.source_path)
        .filter(PublishedFile.source_path.in_(image_file_paths))
        .distinct()
    }
    wp_rows = (
        db.query(WordPressPublishedItem.source_path, WordPressPublishedItem.status)
        .filter(WordPressPublishedItem.source_path.in_(image_file_paths))
        .all()
    )
    wp_status_by_path: dict[str, str] = {}
    for source_path, status in wp_rows:
        if source_path not in wp_status_by_path or status == "publish":
            wp_status_by_path[source_path] = status

    return [
        {
            "id": img.id,
            "subject": img.subject,
            "variation_text": img.variation_text,
            "status": img.status,
            "reject_reason": img.reject_reason,
            "wp_excluded": img.wp_excluded,
            "created_at": img.created_at,
            "locally_published": img.file_path in published_paths,
            "wordpress_status": wp_status_by_path.get(img.file_path),
            "prompt_used": img.prompt_used,
            "job_id": img.job_id,
        }
        for img in images
    ]

def get_jobs_for_category(db: Session, category: str, user_id: int) -> list[GenerationJob]:
    # user_id is required, not optional — category is a free-text string,
    # not a foreign key, so without this filter two different users' jobs
    # sharing a category name (e.g. both named "dinosaurs") would leak
    # into each other's review list.
    return (
        db.query(GenerationJob)
        .filter(
            GenerationJob.category == category,
            GenerationJob.status == "done",
            GenerationJob.user_id == user_id,
        )
        .order_by(GenerationJob.created_at.desc())
        .all()
    )


def reject_image(db: Session, image_id: int, reason: str | None = None) -> GenerationImage:
    """reason is a real, structured signal about the PRODUCT (this specific
    image), not the prompt — e.g. 'gray_busy', 'wrong_subject',
    'broken_line'. Stored alongside the image's own compiled_prompt_json,
    so future review-driven work (quality classifier, etc.) can learn
    from real (image, outcome) pairs, not just prompts in isolation."""
    image = db.query(GenerationImage).filter(GenerationImage.id == image_id).first()
    if not image:
        raise ValueError(f"Generation image {image_id} not found")
    if image.status == "rejected":
        if reason:
            image.reject_reason = reason
            db.commit()
            db.refresh(image)
        return image  # already rejected, no-op beyond updating the reason
    rejected_dir = os.path.join(OUTPUT_DIR, image.category, REJECTED_SUBDIR)
    os.makedirs(rejected_dir, exist_ok=True)
    filename = os.path.basename(image.file_path)
    new_path = os.path.join(rejected_dir, filename)
    if os.path.exists(image.file_path):
        shutil.move(image.file_path, new_path)
    image.status = "rejected"
    # A missing/None reason means "reject again, same as before" (the
    # frontend skips re-prompting once an image already carries a reason
    # from an earlier reject cycle) — so only overwrite reject_reason when
    # a real one is supplied. Restoring an image deliberately leaves this
    # field untouched, precisely so it survives a reject -> restore ->
    # reject-again cycle without asking the user to relabel the same
    # picture, and without silently losing the original signal.
    if reason:
        image.reject_reason = reason
    db.commit()
    db.refresh(image)
    return image


def restore_image(db: Session, image_id: int) -> GenerationImage:
    """Moves a rejected image back to its original location — the safety net
    for the reject-to-quarantine approach."""
    image = db.query(GenerationImage).filter(GenerationImage.id == image_id).first()
    if not image:
        raise ValueError(f"Generation image {image_id} not found")
    if image.status == "approved":
        return image

    rejected_path = os.path.join(OUTPUT_DIR, image.category, REJECTED_SUBDIR, os.path.basename(image.file_path))
    if os.path.exists(rejected_path):
        shutil.move(rejected_path, image.file_path)

    image.status = "approved"
    db.commit()
    db.refresh(image)
    return image


def move_image_to_category(db: Session, image_id: int, new_category_id: int) -> GenerationImage:
    """Recovery tool for images filed under the wrong category — e.g. by
    the since-fixed name-collision bug in build_task_list /
    build_task_list_from_pairs, where two categories sharing a name (in
    different books) could resolve to the wrong one at generation time.
    Moves both the real file on disk and the DB row's category linkage
    to the intended category. Only handles an "approved" image — a
    rejected one lives under a different (name-based) quarantine path,
    so restore it first."""
    from models import Category

    image = db.query(GenerationImage).filter(GenerationImage.id == image_id).first()
    if not image:
        raise ValueError(f"Generation image {image_id} not found")
    if image.status == "rejected":
        raise ValueError("Restore this image before moving it to another category")
    new_category = db.query(Category).filter(Category.id == new_category_id).first()
    if not new_category:
        raise ValueError(f"Category {new_category_id} not found")

    old_path = image.file_path
    new_dir = os.path.join(OUTPUT_DIR, str(new_category_id))
    os.makedirs(new_dir, exist_ok=True)
    new_path = os.path.join(new_dir, os.path.basename(old_path))
    if os.path.exists(old_path) and os.path.abspath(old_path) != os.path.abspath(new_path):
        shutil.move(old_path, new_path)

    image.category_id = new_category_id
    image.category = new_category.name
    image.file_path = new_path
    db.commit()
    db.refresh(image)
    return image


def get_current_file_path(image: GenerationImage) -> str:
    """The file's actual current location on disk, accounting for rejection."""
    if image.status == "rejected":
        return os.path.join(OUTPUT_DIR, image.category, REJECTED_SUBDIR, os.path.basename(image.file_path))
    return image.file_path
