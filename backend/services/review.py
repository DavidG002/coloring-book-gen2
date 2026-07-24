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


def get_jobs_for_category(db: Session, category: str) -> list[GenerationJob]:
    return (
        db.query(GenerationJob)
        .filter(GenerationJob.category == category, GenerationJob.status == "done")
        .order_by(GenerationJob.created_at.desc())
        .all()
    )


def reject_image(db: Session, image_id: int) -> GenerationImage:
    image = db.query(GenerationImage).filter(GenerationImage.id == image_id).first()
    if not image:
        raise ValueError(f"Generation image {image_id} not found")
    if image.status == "rejected":
        return image  # already rejected, no-op

    rejected_dir = os.path.join(OUTPUT_DIR, image.category, REJECTED_SUBDIR)
    os.makedirs(rejected_dir, exist_ok=True)

    filename = os.path.basename(image.file_path)
    new_path = os.path.join(rejected_dir, filename)

    if os.path.exists(image.file_path):
        shutil.move(image.file_path, new_path)

    image.status = "rejected"
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


def get_current_file_path(image: GenerationImage) -> str:
    """The file's actual current location on disk, accounting for rejection."""
    if image.status == "rejected":
        return os.path.join(OUTPUT_DIR, image.category, REJECTED_SUBDIR, os.path.basename(image.file_path))
    return image.file_path
