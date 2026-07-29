from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from services.wordpress_publish import push_batch_to_wordpress
from schemas import WordPressPushRequest, WordPressPushResponse

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
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressPushResponse(**result)