from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import GenerationImage
from services.wordpress_publish import (
    push_batch_to_wordpress, preview_wordpress_push, sync_pushed_item_to_wordpress,
    verify_and_clean_stale_pushes, _get_wp_config, list_wordpress_categories, map_book_to_term,
)
from models import WordPressBookTerm
from schemas import (
    WordPressPushRequest, WordPressPushResponse, WordPressPreviewRequest, WordPressPreviewResponse,
    WordPressSyncRequest, WordPressSyncResponse, WordPressVerifyRequest, WordPressVerifyResponse,
)


class ExcludeRequest(BaseModel):
    source_path: str
    excluded: bool

router = APIRouter(prefix="/wordpress", tags=["wordpress"])


@router.get("/categories")
def get_wordpress_categories(db: Session = Depends(get_db)):
    """Real, live top-level WordPress categories from the connected site —
    used by the Book-mapping setup screen."""
    try:
        config = _get_wp_config(db)
        return list_wordpress_categories(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


class BookMappingRequest(BaseModel):
    lang: str
    wp_term_id: int | None = None
    term_name: str | None = None


@router.post("/books/{book_id}/mapping")
def create_book_mapping(book_id: int, payload: BookMappingRequest, db: Session = Depends(get_db)):
    try:
        config = _get_wp_config(db)
        term_id = map_book_to_term(db, config, book_id, payload.lang, payload.wp_term_id, payload.term_name)
        return {"wp_term_id": term_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/books/{book_id}/mapping")
def get_book_mapping(book_id: int, lang: str, db: Session = Depends(get_db)):
    config = _get_wp_config(db)
    mapping = (
        db.query(WordPressBookTerm)
        .filter(WordPressBookTerm.book_id == book_id, WordPressBookTerm.lang == lang, WordPressBookTerm.site_url == config.site_url)
        .first()
    )
    return {"wp_term_id": mapping.wp_term_id if mapping else None}


@router.post("/push", response_model=WordPressPushResponse)
def push_to_wordpress(payload: WordPressPushRequest, db: Session = Depends(get_db)):
    try:
        result = push_batch_to_wordpress(
            db,
            category_id=payload.category_id,
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
        result = preview_wordpress_push(db, payload.category_id, payload.lang)
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

@router.post("/sync", response_model=WordPressSyncResponse)
def sync_to_wordpress(payload: WordPressSyncRequest, db: Session = Depends(get_db)):
    try:
        result = sync_pushed_item_to_wordpress(db, payload.source_path, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return WordPressSyncResponse(**result)

@router.post("/verify", response_model=WordPressVerifyResponse)
def verify_push(payload: WordPressVerifyRequest, db: Session = Depends(get_db)):
    try:
        result = verify_and_clean_stale_pushes(db, payload.category_id, payload.lang, _get_wp_config(db).site_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressVerifyResponse(**result)