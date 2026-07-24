from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import LanguageTemplateDefault
from schemas import LanguageTemplateDefaultRead, LanguageTemplateDefaultUpdate
from services.translate import translate_template_structure

router = APIRouter(prefix="/language-templates", tags=["language-templates"])


@router.get("/{lang}", response_model=LanguageTemplateDefaultRead)
def get_language_template(lang: str, db: Session = Depends(get_db)):
    row = db.query(LanguageTemplateDefault).filter(LanguageTemplateDefault.lang == lang).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"No saved template default for '{lang}' yet")
    return LanguageTemplateDefaultRead(
        lang=row.lang,
        filename_template=row.filename_template,
        alt_template=row.alt_template,
        title_template=row.title_template,
    )


@router.put("/{lang}", response_model=LanguageTemplateDefaultRead)
def update_language_template(lang: str, payload: LanguageTemplateDefaultUpdate, db: Session = Depends(get_db)):
    row = db.query(LanguageTemplateDefault).filter(LanguageTemplateDefault.lang == lang).first()
    if not row:
        row = LanguageTemplateDefault(
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
        lang=row.lang,
        filename_template=row.filename_template,
        alt_template=row.alt_template,
        title_template=row.title_template,
    )


@router.post("/{lang}/auto-translate", response_model=LanguageTemplateDefaultRead)
def auto_translate_language_template(lang: str, db: Session = Depends(get_db)):
    translated = translate_template_structure(lang)

    row = db.query(LanguageTemplateDefault).filter(LanguageTemplateDefault.lang == lang).first()
    if not row:
        row = LanguageTemplateDefault(
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
        lang=row.lang,
        filename_template=row.filename_template,
        alt_template=row.alt_template,
        title_template=row.title_template,
    )
