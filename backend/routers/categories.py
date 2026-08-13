from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Category, Subject, Variation, Book
from services.book_deletion import get_category_deletion_info, delete_category_cascade
from schemas import CategoryCreate, CategoryUpdate, CategoryRead, CategorySummary, CategoryDeletionInfo, CategoryDeletionResult

router = APIRouter(prefix="/categories", tags=["categories"])


def _to_category_read(category: Category) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        name=category.name,
        book_id=category.book_id,
        book_name=category.book.name,
        subjects=category.subjects,
        variations=category.variations,
    )


@router.get("", response_model=list[CategorySummary])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).options(joinedload(Category.book)).all()
    return [
        CategorySummary(
            id=c.id,
            name=c.name,
            book_id=c.book_id,
            book_name=c.book.name,
            subject_count=len(c.subjects),
            variation_count=len(c.variations),
        )
        for c in categories
    ]


@router.get("/{name}", response_model=CategoryRead)
def get_category(name: str, db: Session = Depends(get_db)):
    category = (
        db.query(Category)
        .options(joinedload(Category.subjects), joinedload(Category.variations), joinedload(Category.book))
        .filter(Category.name == name)
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{name}' not found")
    return _to_category_read(category)


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{payload.name}' already exists")

    book = db.query(Book).filter(Book.id == payload.book_id).first()
    if not book:
        raise HTTPException(status_code=400, detail=f"Book {payload.book_id} not found")

    category = Category(name=payload.name, book_id=payload.book_id)
    db.add(category)
    db.flush()

    for subject_name in payload.subjects:
        db.add(Subject(category_id=category.id, name=subject_name))

    for i, variation_text in enumerate(payload.variations):
        db.add(Variation(category_id=category.id, text=variation_text, order=i))

    db.commit()
    db.refresh(category)
    return _to_category_read(category)


@router.put("/{name}", response_model=CategoryRead)
def update_category(name: str, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.name == name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{name}' not found")

    if payload.subjects is not None:
        existing_by_name = {s.name: s for s in category.subjects}
        desired_names = set(payload.subjects)

        for subj_name, subject in existing_by_name.items():
            if subj_name not in desired_names:
                db.delete(subject)

        for subj_name in payload.subjects:
            if subj_name not in existing_by_name:
                db.add(Subject(category_id=category.id, name=subj_name))

        db.flush()

    if payload.variations is not None:
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
    return _to_category_read(category)


@router.get("/{name}/deletion-info", response_model=CategoryDeletionInfo)
def category_deletion_info(name: str, db: Session = Depends(get_db)):
    try:
        return get_category_deletion_info(db, name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{name}", response_model=CategoryDeletionResult)
def delete_category(name: str, delete_files: bool = False, db: Session = Depends(get_db)):
    try:
        return delete_category_cascade(db, name, delete_files)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
