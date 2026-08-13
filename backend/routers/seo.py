from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Category, Translation, Subject, Variation, ContentVariant, CategoryDescription
from schemas import (
    SeoDataResponse, SeoContentVariantRow, SeoContentVariantUpdate,
    SeoRegenerateRequest, CategoryDescriptionUpdate,
)
from services.content_variants import (
    ensure_content_variant, regenerate_content_variant, list_content_variants,
    ensure_category_description, regenerate_category_description,
)

router = APIRouter(prefix="/categories/{category_name}/seo", tags=["seo"])


def _get_translation_or_404(db: Session, category_name: str, lang: str) -> Translation:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found")
    translation = db.query(Translation).filter(Translation.category_id == category.id, Translation.lang == lang).first()
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category_name}' — create it first")
    return translation


@router.get("/{lang}", response_model=SeoDataResponse)
def get_seo_data(category_name: str, lang: str, db: Session = Depends(get_db)):
    translation = _get_translation_or_404(db, category_name, lang)
    description = ensure_category_description(db, category_name, translation.category_translated, lang)
    variants = list_content_variants(db, category_name, lang)
    return SeoDataResponse(
        category_description=description,
        content_variants=[SeoContentVariantRow(**v) for v in variants],
    )


@router.put("/{lang}/description")
def update_description(category_name: str, lang: str, payload: CategoryDescriptionUpdate, db: Session = Depends(get_db)):
    existing = db.query(CategoryDescription).filter(CategoryDescription.category == category_name, CategoryDescription.lang == lang).first()
    if not existing:
        existing = CategoryDescription(category=category_name, lang=lang, description=payload.description)
        db.add(existing)
    else:
        existing.description = payload.description
    db.commit()
    return {"description": existing.description}


@router.post("/{lang}/description/regenerate")
def regen_description(category_name: str, lang: str, db: Session = Depends(get_db)):
    translation = _get_translation_or_404(db, category_name, lang)
    try:
        description = regenerate_category_description(db, category_name, translation.category_translated, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"description": description}


@router.put("/{lang}/content")
def update_content_variant(category_name: str, lang: str, payload: SeoContentVariantUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found")
    subject = db.query(Subject).filter(Subject.category_id == category.id, Subject.name == payload.subject_name).first()
    variation = db.query(Variation).filter(Variation.category_id == category.id, Variation.text == payload.variation_text).first()
    if not subject or not variation:
        raise HTTPException(status_code=400, detail="Subject or variation not found in this category")

    existing = (
        db.query(ContentVariant)
        .filter(ContentVariant.subject_id == subject.id, ContentVariant.variation_id == variation.id, ContentVariant.lang == lang)
        .first()
    )
    if not existing:
        existing = ContentVariant(subject_id=subject.id, variation_id=variation.id, lang=lang, seo_title="", seo_alt_text="", seo_excerpt="", seo_content="")
        db.add(existing)

    existing.seo_title = payload.seo_title
    existing.seo_alt_text = payload.seo_alt_text
    existing.seo_excerpt = payload.seo_excerpt
    existing.seo_content = payload.seo_content
    db.commit()
    return {"status": "saved"}


@router.post("/{lang}/content/generate-missing")
def generate_missing_content(category_name: str, lang: str, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found")

    generated_count = 0
    for row in list_content_variants(db, category_name, lang):
        if not row["generated"]:
            try:
                ensure_content_variant(db, category_name, row["subject_name"], row["variation_text"], lang)
                generated_count += 1
            except Exception:
                continue
    return {"generated_count": generated_count}


@router.post("/{lang}/content/regenerate")
def regen_one_content(category_name: str, lang: str, payload: SeoRegenerateRequest, db: Session = Depends(get_db)):
    try:
        variant = regenerate_content_variant(db, category_name, payload.subject_name, payload.variation_text, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "seo_title": variant.seo_title,
        "seo_alt_text": variant.seo_alt_text,
        "seo_excerpt": variant.seo_excerpt,
        "seo_content": variant.seo_content,
    }
