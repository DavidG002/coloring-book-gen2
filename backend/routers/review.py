import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from services.review import get_images_for_job, get_jobs_for_category, reject_image, restore_image, get_current_file_path

router = APIRouter(prefix="/review", tags=["review"])


@router.get("/jobs/{category_name}")
def list_jobs(category_name: str, db: Session = Depends(get_db)):
    jobs = get_jobs_for_category(db, category_name)
    return [
        {
            "job_id": j.id,
            "created_at": j.created_at,
            "total_images": j.total_images,
            "completed_images": j.completed_images,
        }
        for j in jobs
    ]


@router.get("/jobs/{category_name}/{job_id}/images")
def list_job_images(category_name: str, job_id: int, db: Session = Depends(get_db)):
    images = get_images_for_job(db, job_id)
    return [
        {
            "id": img.id,
            "subject": img.subject,
            "variation_number": img.variation_number,
            "variation_text": img.variation_text,
            "status": img.status,
            "filename": os.path.basename(img.file_path),
        }
        for img in images
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
def reject(image_id: int, db: Session = Depends(get_db)):
    try:
        image = reject_image(db, image_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": image.id, "status": image.status}


@router.post("/image/{image_id}/restore")
def restore(image_id: int, db: Session = Depends(get_db)):
    try:
        image = restore_image(db, image_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": image.id, "status": image.status}
