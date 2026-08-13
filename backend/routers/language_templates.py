from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import LanguageTemplateDefault, Book
from schemas import LanguageTemplateDefaultRead, LanguageTemplateDefaultUpdate
from services.translate import translate_template_structure_for_book

router = APIRouter(prefix="/books/{book_id}/language-templates", tags=["language-templates"])


@router.get("/{lang}", response_model=LanguageTemplateDefaultRead)
def get_language_template(book_id: int, lang: str, db: Session = Depends(get_db)):
    row = (
        db.query(LanguageTemplateDefault)
        .filter(LanguageTemplateDefault.book_id == book_id, LanguageTemplateDefault.lang == lang)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"No saved template default for '{lang}' on this book yet")
    return LanguageTemplateDefaultRead(
        book_id=row.book_id,
        lang=row.lang,
        filename_template=row.filename_template,
        alt_template=row.alt_template,
        title_template=row.title_template,
    )


@router.put("/{lang}", response_model=LanguageTemplateDefaultRead)
def update_language_template(book_id: int, lang: str, payload: LanguageTemplateDefaultUpdate, db: Session = Depends(get_db)):
    row = (
        db.query(LanguageTemplateDefault)
        .filter(LanguageTemplateDefault.book_id == book_id, LanguageTemplateDefault.lang == lang)
        .first()
    )
    if not row:
        row = LanguageTemplateDefault(
            book_id=book_id,
            lang=lang,
            filename_template=payload.filename_template or "",
            alt_template=payload.alt_template or "",
            title_template=payload.title_template or "",
        )
        db.add(row)
    else:
        if payload.filename_template is not None:
            row.filename_template = payload.filename_template
        if payload.alt_template is not None:
            row.alt_template = payload.alt_template
        if payload.title_template is not None:
            row.title_template = payload.title_template

    db.commit()
    db.refresh(row)
    return LanguageTemplateDefaultRead(
        book_id=row.book_id,
        lang=row.lang,
        filename_template=row.filename_template,
        alt_template=row.alt_template,
        title_template=row.title_template,
    )


@router.post("/{lang}/auto-translate", response_model=LanguageTemplateDefaultRead)
def auto_translate_language_template(book_id: int, lang: str, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    translated = translate_template_structure_for_book(book.product_noun, lang)

    row = (
        db.query(LanguageTemplateDefault)
        .filter(LanguageTemplateDefault.book_id == book_id, LanguageTemplateDefault.lang == lang)
        .first()
    )
    if not row:
        row = LanguageTemplateDefault(
            book_id=book_id,
            lang=lang,
            filename_template=translated["filename_template"],
            alt_template=translated["alt_template"],
            title_template=translated["title_template"],
        )
        db.add(row)
    else:
        row.filename_template = translated["filename_template"]
        row.alt_template = translated["alt_template"]
        row.title_template = translated["title_template"]

    db.commit()
    db.refresh(row)
    return LanguageTemplateDefaultRead(
        book_id=row.book_id,
        lang=row.lang,
        filename_template=row.filename_template,
        alt_template=row.alt_template,
        title_template=row.title_template,
    )
