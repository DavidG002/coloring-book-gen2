from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Category, Subject, Variation, Translation, TranslationItem, VariationTranslationItem
from schemas import (
    TranslationCreate, TranslationUpdate, TranslationRead,
    TranslationItemRead, VariationTranslationItemRead,
    TranslateVariationsRequest, TranslateVariationsResponse,
)
from services.translate import translate_phrases
from schemas import TranslateCategoryNameResponse


router = APIRouter(prefix="/categories/{category_id}/translations", tags=["translations"])


def _get_category_or_404(category_id: int, db: Session) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
    return category


def _to_translation_read(translation: Translation) -> TranslationRead:
    """Builds TranslationRead manually since subject_name/variation_text aren't
    direct columns — they live on the related Subject/Variation."""
    return TranslationRead(
        id=translation.id,
        category_id=translation.category_id,
        lang=translation.lang,
        category_translated=translation.category_translated,
        filename_template=translation.filename_template,
        alt_template=translation.alt_template,
        title_template=translation.title_template,
        items=[
            TranslationItemRead(
                id=item.id,
                subject_id=item.subject_id,
                subject_name=item.subject.name,
                translated_text=item.translated_text,
            )
            for item in translation.items
        ],
        variation_items=[
            VariationTranslationItemRead(
                id=item.id,
                variation_id=item.variation_id,
                variation_text=item.variation.text,
                translated_text=item.translated_text,
            )
            for item in translation.variation_items
        ],
    )


@router.get("", response_model=list[TranslationRead])
def list_translations(category_id: int, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    return [_to_translation_read(t) for t in category.translations]


@router.get("/{lang}", response_model=TranslationRead)
def get_translation(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    translation = next((t for t in category.translations if t.lang == lang), None)
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}'")
    return _to_translation_read(translation)


def _resolve_subject_id(category: Category, subject_name: str, db: Session) -> int:
    subject = (
        db.query(Subject)
        .filter(Subject.category_id == category.id, Subject.name == subject_name)
        .first()
    )
    if not subject:
        raise HTTPException(
            status_code=400,
            detail=f"Subject '{subject_name}' does not exist in category '{category.name}'",
        )
    return subject.id

def _resolve_variation_id(category: Category, variation_text: str, db: Session) -> int:
    variation = (
        db.query(Variation)
        .filter(Variation.category_id == category.id, Variation.text == variation_text)
        .first()
    )
    if not variation:
        raise HTTPException(
            status_code=400,
            detail=f"Variation '{variation_text}' does not exist in category '{category.name}'",
        )
    return variation.id


@router.post("", response_model=TranslationRead, status_code=201)
def create_translation(category_id: int, payload: TranslationCreate, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)

    existing = next((t for t in category.translations if t.lang == payload.lang), None)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Translation '{payload.lang}' already exists for '{category.name}' — use PUT to update it",
        )

    translation = Translation(
        category_id=category.id,
        lang=payload.lang,
        category_translated=payload.category_translated,
        filename_template=payload.filename_template,
        alt_template=payload.alt_template,
        title_template=payload.title_template,
    )
    db.add(translation)
    db.flush()

    for item in payload.items:
        subject_id = _resolve_subject_id(category, item.subject_name, db)
        db.add(TranslationItem(translation_id=translation.id, subject_id=subject_id, translated_text=item.translated_text))

    for item in payload.variation_items:
        variation_id = _resolve_variation_id(category, item.variation_text, db)
        db.add(VariationTranslationItem(translation_id=translation.id, variation_id=variation_id, translated_text=item.translated_text))

    db.commit()
    db.refresh(translation)
    return _to_translation_read(translation)


@router.put("/{lang}", response_model=TranslationRead)
def update_translation(category_id: int, lang: str, payload: TranslationUpdate, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    translation = next((t for t in category.translations if t.lang == lang), None)
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}'")

    if payload.category_translated is not None:
        translation.category_translated = payload.category_translated
    if payload.filename_template is not None:
        translation.filename_template = payload.filename_template
    if payload.alt_template is not None:
        translation.alt_template = payload.alt_template
    if payload.title_template is not None:
        translation.title_template = payload.title_template

    if payload.items is not None:
        db.query(TranslationItem).filter(TranslationItem.translation_id == translation.id).delete()
        for item in payload.items:
            subject_id = _resolve_subject_id(category, item.subject_name, db)
            db.add(TranslationItem(translation_id=translation.id, subject_id=subject_id, translated_text=item.translated_text))

    if payload.variation_items is not None:
        db.query(VariationTranslationItem).filter(VariationTranslationItem.translation_id == translation.id).delete()
        for item in payload.variation_items:
            variation_id = _resolve_variation_id(category, item.variation_text, db)
            db.add(VariationTranslationItem(translation_id=translation.id, variation_id=variation_id, translated_text=item.translated_text))

    db.commit()
    db.refresh(translation)
    return _to_translation_read(translation)


@router.delete("/{lang}", status_code=204)
def delete_translation(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    translation = next((t for t in category.translations if t.lang == lang), None)
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}'")
    db.delete(translation)
    db.commit()


@router.post("/{lang}/translate-variations", response_model=TranslateVariationsResponse)
def translate_variations(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    translation = next((t for t in category.translations if t.lang == lang), None)
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}' — create it first")

    already_translated = {item.variation.text for item in translation.variation_items}
    to_translate = [v.text for v in category.variations if v.text not in already_translated]

    if not to_translate:
        return TranslateVariationsResponse(translated_count=0, skipped_count=len(category.variations))

    results = translate_phrases(to_translate, lang)

    for variation_text, translated_text in results.items():
        if not translated_text:
            continue
        variation = next((v for v in category.variations if v.text == variation_text), None)
        if variation:
            db.add(VariationTranslationItem(
                translation_id=translation.id,
                variation_id=variation.id,
                translated_text=translated_text,
            ))

    db.commit()

    return TranslateVariationsResponse(
        translated_count=len(results),
        skipped_count=len(already_translated),
    )


@router.post("/{lang}/translate-subjects", response_model=TranslateVariationsResponse)
def translate_subjects(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    translation = next((t for t in category.translations if t.lang == lang), None)
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}' — create it first")

    already_translated = {item.subject.name for item in translation.items}
    to_translate = [s.name for s in category.subjects if s.name not in already_translated]

    if not to_translate:
        return TranslateVariationsResponse(translated_count=0, skipped_count=len(category.subjects))

    results = translate_phrases(to_translate, lang)

    for subject_name, translated_text in results.items():
        if not translated_text:
            continue
        subject = next((s for s in category.subjects if s.name == subject_name), None)
        if subject:
            db.add(TranslationItem(
                translation_id=translation.id,
                subject_id=subject.id,
                translated_text=translated_text,
            ))

    db.commit()

    return TranslateVariationsResponse(
        translated_count=len(results),
        skipped_count=len(already_translated),
    )


@router.post("/{lang}/translate-category-name", response_model=TranslateCategoryNameResponse)
def translate_category_name(category_id: int, lang: str, db: Session = Depends(get_db)):
    category = _get_category_or_404(category_id, db)
    results = translate_phrases([category.name], lang)
    translated = results.get(category.name, "")
    return TranslateCategoryNameResponse(translated_text=translated)