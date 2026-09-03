from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Category, Translation, Subject, Variation, ContentVariant, CategoryDescription
from schemas import (
    SeoDataResponse, SeoContentVariantRow, SeoContentVariantUpdate,
    SeoRegenerateRequest, CategoryDescriptionUpdate, SeoFieldRegenerateRequest, SeoFieldRegenerateResponse,
)
from services.content_variants import (
    ensure_content_variant, regenerate_content_variant, list_content_variants,
    ensure_category_description, regenerate_category_description, regenerate_single_field,
)

router = APIRouter(prefix="/categories/{category_id}/seo", tags=["seo"])


def _get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
    return category


def _get_translation_or_404(db: Session, category: Category, lang: str) -> Translation:
    translation = db.query(Translation).filter(Translation.category_id == category.id, Translation.lang == lang).first()
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}' — create it first")
    return translation


@router.get("/{lang}", response_model=SeoDataResponse)
def get_seo_data(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)
    translation = _get_translation_or_404(db, category, lang)
    description = ensure_category_description(db, category.id, translation.category_translated, lang)
    variants = list_content_variants(db, category.id, lang)
    return SeoDataResponse(
        category_description=description,
        content_variants=[SeoContentVariantRow(**v) for v in variants],
    )


@router.put("/{lang}/description")
def update_description(category_id: int, lang: str, payload: CategoryDescriptionUpdate, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)
    existing = db.query(CategoryDescription).filter(CategoryDescription.category == category.name, CategoryDescription.lang == lang).first()
    if not existing:
        existing = CategoryDescription(category=category.name, lang=lang, description=payload.description)
        db.add(existing)
    else:
        existing.description = payload.description
    db.commit()
    return {"description": existing.description}


@router.post("/{lang}/description/regenerate")
def regen_description(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)
    translation = _get_translation_or_404(db, category, lang)
    try:
        description = regenerate_category_description(db, category.id, translation.category_translated, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"description": description}


@router.put("/{lang}/content")
def update_content_variant(category_id: int, lang: str, payload: SeoContentVariantUpdate, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)
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
    existing.focus_keyphrase = payload.focus_keyphrase
    existing.yoast_title = payload.yoast_title
    existing.yoast_meta_description = payload.yoast_meta_description
    db.commit()
    return {"status": "saved"}


@router.post("/{lang}/content/generate-missing")
def generate_missing_content(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)

    generated_count = 0
    for row in list_content_variants(db, category.id, lang):
        if not row["generated"]:
            try:
                ensure_content_variant(db, category.id, row["subject_name"], row["variation_text"], lang)
                generated_count += 1
            except Exception:
                continue
    return {"generated_count": generated_count}


@router.post("/{lang}/content/regenerate")
def regen_one_content(category_id: int, lang: str, payload: SeoRegenerateRequest, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)
    try:
        variant = regenerate_content_variant(db, category.id, payload.subject_name, payload.variation_text, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "seo_title": variant.seo_title,
        "seo_alt_text": variant.seo_alt_text,
        "seo_excerpt": variant.seo_excerpt,
        "seo_content": variant.seo_content,
        "focus_keyphrase": variant.focus_keyphrase,
        "yoast_title": variant.yoast_title,
        "yoast_meta_description": variant.yoast_meta_description,
    }

@router.post("/{lang}/content/regenerate-field", response_model=SeoFieldRegenerateResponse)
def regen_single_field(category_id: int, lang: str, payload: SeoFieldRegenerateRequest, db: Session = Depends(get_db)):
    try:
        value = regenerate_single_field(db, category_id, payload.subject_name, payload.variation_text, lang, payload.field)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return SeoFieldRegenerateResponse(field=payload.field, value=value)