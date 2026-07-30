from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import GenerationImage
from services.wordpress_publish import push_batch_to_wordpress, preview_wordpress_push
from schemas import WordPressPushRequest, WordPressPushResponse, WordPressPreviewRequest, WordPressPreviewResponse


class ExcludeRequest(BaseModel):
    source_path: str
    excluded: bool

router = APIRouter(prefix="/wordpress", tags=["wordpress"])


@router.post("/push", response_model=WordPressPushResponse)
def push_to_wordpress(payload: WordPressPushRequest, db: Session = Depends(get_db)):
    try:
        result = push_batch_to_wordpress(
            db,
            category_name=payload.category,
            lang=payload.lang,
            status=payload.status,
            only_new=payload.only_new,
            source_paths=payload.source_paths,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressPushResponse(**result)

@router.post("/preview", response_model=WordPressPreviewResponse)
def preview_push(payload: WordPressPreviewRequest, db: Session = Depends(get_db)):
    try:
        result = preview_wordpress_push(db, payload.category, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressPreviewResponse(**result)

@router.post("/exclude")
def set_exclude(payload: ExcludeRequest, db: Session = Depends(get_db)):
    image = db.query(GenerationImage).filter(GenerationImage.file_path == payload.source_path).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    image.wp_excluded = payload.excluded
    db.commit()
    return {"source_path": payload.source_path, "excluded": image.wp_excluded}