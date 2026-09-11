import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from schemas import ReviewJob, ReviewImage, CategoryImageStatus, RejectImageRequest
from services.review import get_images_for_job, get_jobs_for_category, reject_image, restore_image, get_current_file_path, get_images_for_category

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/jobs/{category_name}", response_model=list[ReviewJob])
def list_jobs(category_name: str, db: Session = Depends(get_db)):
    jobs = get_jobs_for_category(db, category_name)
    return [
        ReviewJob(
            job_id=j.id,
            created_at=j.created_at,
            total_images=j.total_images,
            completed_images=j.completed_images,
        )
        for j in jobs
    ]


@router.get("/jobs/{category_name}/{job_id}/images", response_model=list[ReviewImage])
def list_job_images(category_name: str, job_id: int, db: Session = Depends(get_db)):
    images = get_images_for_job(db, job_id)
    return [
        ReviewImage(
            id=img.id,
            subject=img.subject,
            variation_number=img.variation_number,
            variation_text=img.variation_text,
            status=img.status,
            filename=os.path.basename(img.file_path),
        )
        for img in images
    ]


@router.get("/images-by-ids", response_model=list[ReviewImage])
def get_images_by_ids(ids: str, db: Session = Depends(get_db)):
    """Resolves a comma-separated list of real image IDs into their full
    details — used by the Publish page's selected-images preview, which
    only carries raw IDs forward from Generate's selection checkboxes."""
    from models import GenerationImage
    try:
        id_list = [int(i) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be a comma-separated list of integers")

    images = db.query(GenerationImage).filter(GenerationImage.id.in_(id_list)).all()
    by_id = {img.id: img for img in images}
    # Preserve the caller's original order, silently skipping any ID that
    # no longer exists (e.g. deleted since selection).
    ordered = [by_id[i] for i in id_list if i in by_id]

    return [
        ReviewImage(
            id=img.id,
            subject=img.subject,
            variation_number=img.variation_number,
            variation_text=img.variation_text,
            status=img.status,
            filename=os.path.basename(img.file_path),
        )
        for img in ordered
    ]


@router.get("/image/{image_id}/file")
def serve_image_file(image_id: int, db: Session = Depends(get_db)):
    from models import GenerationImage
    image = db.query(GenerationImage).filter(GenerationImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    path = get_current_file_path(image)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image file missing on disk")

    return FileResponse(path, media_type="image/png")


@router.post("/image/{image_id}/reject")
def reject(image_id: int, payload: RejectImageRequest | None = None, db: Session = Depends(get_db)):
    try:
        reason = payload.reason if payload else None
        image = reject_image(db, image_id, reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": image.id, "status": image.status, "reject_reason": image.reject_reason}


@router.post("/image/{image_id}/restore")
def restore(image_id: int, db: Session = Depends(get_db)):
    try:
        image = restore_image(db, image_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": image.id, "status": image.status}


@router.get("/images/{category_id}", response_model=list[CategoryImageStatus])
def list_category_images(category_id: int, db: Session = Depends(get_db)):
    return get_images_for_category(db, category_id)
