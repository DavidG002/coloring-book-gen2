from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Category, Subject, Variation
from schemas import CategoryCreate, CategoryUpdate, CategoryRead, CategorySummary

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategorySummary])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    return [
        CategorySummary(
            id=c.id,
            name=c.name,
            subject_count=len(c.subjects),
            variation_count=len(c.variations),
        )
        for c in categories
    ]


@router.get("/{name}", response_model=CategoryRead)
def get_category(name: str, db: Session = Depends(get_db)):
    category = (
        db.query(Category)
        .options(joinedload(Category.subjects), joinedload(Category.variations))
        .filter(Category.name == name)
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{name}' not found")
    return category


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{payload.name}' already exists")

    category = Category(name=payload.name, base_prompt=payload.base_prompt)
    db.add(category)
    db.flush()  # assigns category.id without committing yet, so we can use it below

    for subject_name in payload.subjects:
        db.add(Subject(category_id=category.id, name=subject_name))

    for i, variation_text in enumerate(payload.variations):
        db.add(Variation(category_id=category.id, text=variation_text, order=i))

    db.commit()
    db.refresh(category)
    return category


@router.put("/{name}", response_model=CategoryRead)
def update_category(name: str, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.name == name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{name}' not found")

    if payload.base_prompt is not None:
        category.base_prompt = payload.base_prompt

    if payload.subjects is not None:
        # Diff-based update: only remove subjects no longer present, only add
        # genuinely new ones. Untouched subjects keep their existing row/ID,
        # so their linked translations survive edits that don't concern them.
        existing_by_name = {s.name: s for s in category.subjects}
        desired_names = set(payload.subjects)

        for name, subject in existing_by_name.items():
            if name not in desired_names:
                db.delete(subject)

        for name in payload.subjects:
            if name not in existing_by_name:
                db.add(Subject(category_id=category.id, name=name))

        db.flush()

    if payload.variations is not None:
        # Same diff approach, plus re-sync `order` for everything since
        # position can change even when the set of variations doesn't.
        existing_by_text = {v.text: v for v in category.variations}
        desired_texts = set(payload.variations)

        for text, variation in existing_by_text.items():
            if text not in desired_texts:
                db.delete(variation)

        db.flush()

        for i, text in enumerate(payload.variations):
            if text in existing_by_text:
                existing_by_text[text].order = i
            else:
                db.add(Variation(category_id=category.id, text=text, order=i))
    db.flush()
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{name}", status_code=204)
def delete_category(name: str, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.name == name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{name}' not found")
    db.delete(category)  # cascade in models.py cleans up subjects/variations/translations
    db.commit()