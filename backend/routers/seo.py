from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Category, Translation, Subject, Variation, ContentVariant, CategoryDescription, User
from schemas import (
    SeoDataResponse, SeoContentVariantRow, SeoContentVariantUpdate,
    SeoRegenerateRequest, CategoryDescriptionUpdate, SeoFieldRegenerateRequest, SeoFieldRegenerateResponse,
)
from services.content_variants import (
    ensure_content_variant, regenerate_content_variant, list_content_variants,
    ensure_category_description, regenerate_category_description, regenerate_single_field,
)
from services.auth import get_current_user
from services.ownership import get_owned_category

router = APIRouter(prefix="/categories/{category_id}/seo", tags=["seo"])


def _get_category_or_404(db: Session, category_id: int, user: User) -> Category:
    return get_owned_category(category_id, user, db)


def _get_translation_or_404(db: Session, category: Category, lang: str) -> Translation:
    translation = db.query(Translation).filter(Translation.category_id == category.id, Translation.lang == lang).first()
    if not translation:
        raise HTTPException(status_code=404, detail=f"No '{lang}' translation for '{category.name}' — create it first")
    return translation


@router.get("/pending-review-count")
def get_seo_pending_review_count(category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """A lightweight aggregate check — how many ContentVariant rows across
    ALL languages are currently pending_review for this category. Used by
    the Generate page to show a real-time banner right when a generation
    job completes, without needing to know which languages exist or fetch
    full SEO data for each. Registered before the /{lang} route below,
    since FastAPI matches routes in registration order — a later position
    here would have "pending-review-count" incorrectly matched as if it
    were a language code."""
    category = _get_category_or_404(db, category_id, user)
    subject_ids = [s.id for s in category.subjects]
    count = db.query(ContentVariant).filter(
        ContentVariant.subject_id.in_(subject_ids), ContentVariant.pending_review == True
    ).count()
    return {"count": count}


@router.get("/{lang}", response_model=SeoDataResponse)
def get_seo_data(category_id: int, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = _get_category_or_404(db, category_id, user)
    translation = _get_translation_or_404(db, category, lang)
    description = ensure_category_description(db, category.id, translation.category_translated, lang)
    variants = list_content_variants(db, category.id, lang)
    return SeoDataResponse(
        category_description=description,
        content_variants=[SeoContentVariantRow(**v) for v in variants],
    )


@router.put("/{lang}/description")
def update_description(category_id: int, lang: str, payload: CategoryDescriptionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = _get_category_or_404(db, category_id, user)
    existing = db.query(CategoryDescription).filter(CategoryDescription.category == category.name, CategoryDescription.lang == lang).first()
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
    existing.needs_tag_sync = False
    db.commit()
    return {"status": "saved"}


@router.post("/{lang}/description/regenerate")
def regen_description(category_id: int, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = _get_category_or_404(db, category_id, user)
    translation = _get_translation_or_404(db, category, lang)
    try:
        description = regenerate_category_description(db, category.id, translation.category_translated, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"description": description}


@router.put("/{lang}/content")
def update_content_variant(category_id: int, lang: str, payload: SeoContentVariantUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = _get_category_or_404(db, category_id, user)
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


@router.post("/{lang}/content/acknowledge-tag-sync")
def acknowledge_tag_sync(category_id: int, lang: str, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Clears needs_tag_sync on one ContentVariant row without touching its
    content — for the case where a tag rename didn't actually require any
    SEO text change, and a human just needs to confirm that and move on."""
    category = _get_category_or_404(db, category_id, user)
    subject_name = payload.get("subject_name")
    variation_text = payload.get("variation_text")
    subject = db.query(Subject).filter(Subject.category_id == category.id, Subject.name == subject_name).first()
    variation = db.query(Variation).filter(Variation.category_id == category.id, Variation.text == variation_text).first()
    if not subject or not variation:
        raise HTTPException(status_code=400, detail="Subject or variation not found in this category")

    existing = (
        db.query(ContentVariant)
        .filter(ContentVariant.subject_id == subject.id, ContentVariant.variation_id == variation.id, ContentVariant.lang == lang)
        .first()
    )
    if existing:
        existing.needs_tag_sync = False
        db.commit()
    return {"status": "acknowledged"}


@router.post("/{lang}/content/generate-missing")
def generate_missing_content(category_id: int, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = _get_category_or_404(db, category_id, user)

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
def regen_one_content(category_id: int, lang: str, payload: SeoRegenerateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = _get_category_or_404(db, category_id, user)
    try:
        variant = regenerate_content_variant(db, category.id, payload.subject_name, payload.variation_text, lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    variant.needs_tag_sync = False
    db.commit()
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
def regen_single_field(category_id: int, lang: str, payload: SeoFieldRegenerateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_category_or_404(db, category_id, user)
    try:
        value = regenerate_single_field(db, category_id, payload.subject_name, payload.variation_text, lang, payload.field)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return SeoFieldRegenerateResponse(field=payload.field, value=value)


@router.post("/{lang}/mark-reviewed")
def mark_seo_reviewed(category_id: int, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Called when a user opens (and closes) a language's SEO/Publish
    editor — clears pending_review on every ContentVariant for that
    language, regardless of whether anything was actually edited.
    Viewing counts as reviewing; no save/edit required."""
    category = _get_category_or_404(db, category_id, user)
    subject_ids = [s.id for s in category.subjects]
    variants = db.query(ContentVariant).filter(
        ContentVariant.subject_id.in_(subject_ids), ContentVariant.lang == lang
    ).all()
    for v in variants:
        v.pending_review = False
    db.commit()
    return {"success": True}