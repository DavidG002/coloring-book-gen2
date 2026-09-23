from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
from models import Category, Subject, Variation, Book, User
from services.book_deletion import get_category_deletion_info, delete_category_cascade
from services.translate import auto_translate_new_items, generate_all_translations_for_category
from schemas import CategoryCreate, CategoryUpdate, CategoryRead, CategorySummary, CategoryDeletionInfo, CategoryDeletionResult
from services.auth import get_current_user
from services.ownership import get_owned_book, get_owned_category
router = APIRouter(prefix="/categories", tags=["categories"])


def _to_category_read(category: Category, auto_translated: dict | None = None) -> CategoryRead:
    return CategoryRead(
        id=category.id,
        name=category.name,
        book_id=category.book_id,
        book_name=category.book.name,
        subjects=category.subjects,
        variations=category.variations,
        auto_translated=auto_translated or {},
        base_prompt=category.base_prompt,
        effective_base_prompt=category.effective_base_prompt,
    )

@router.get("/by-name/{book_id}/{category_name}/base-prompt")
def get_category_base_prompt_by_name(book_id: int, category_name: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_book(book_id, user, db)
    category = db.query(Category).filter(Category.book_id == book_id, Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found in book {book_id}")
    return {"base_prompt": category.base_prompt or ""}


@router.put("/by-name/{book_id}/{category_name}/base-prompt")
def set_category_base_prompt_by_name(book_id: int, category_name: str, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_book(book_id, user, db)
    category = db.query(Category).filter(Category.book_id == book_id, Category.name == category_name).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found in book {book_id}")
    category.base_prompt = payload.get("base_prompt", "")
    db.commit()
    return {"base_prompt": category.base_prompt}

@router.get("", response_model=list[CategorySummary])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    categories = (
        db.query(Category)
        .join(Book, Category.book_id == Book.id)
        .options(joinedload(Category.book))
        .filter(Book.user_id == user.id)
        .all()
    )
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
@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(category_id, user, db)
    category = (
        db.query(Category)
        .options(joinedload(Category.subjects), joinedload(Category.variations), joinedload(Category.book))
        .filter(Category.id == category_id)
        .first()
    )
    return _to_category_read(category)

@router.post("", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_book(payload.book_id, user, db)
    existing = (
        db.query(Category)
        .filter(Category.book_id == payload.book_id, Category.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{payload.name}' already exists in this book")
    category = Category(name=payload.name, book_id=payload.book_id)
    db.add(category)
    db.flush()
    for subject_name in payload.subjects:
        db.add(Subject(category_id=category.id, name=subject_name))
    for i, variation_text in enumerate(payload.variations):
        db.add(Variation(category_id=category.id, text=variation_text, order=i))
    db.commit()
    db.refresh(category)
    # Fire-and-forget: sets up a Translation (templates + translated name)
    # for every language on the account, in the background, so the category
    # is already ready in every language by the time anyone opens its
    # Language step — no manual "Generate all" click needed. Runs after the
    # response is sent and never blocks category creation.
    background_tasks.add_task(generate_all_translations_for_category, category.id)
    return _to_category_read(category)

@router.put("/{category_id}", response_model=CategoryRead)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    category = get_owned_category(category_id, user, db)

    if payload.base_prompt is not None:
        category.base_prompt = payload.base_prompt

    new_subjects = []
    new_variations = []

    if payload.subjects is not None:
        existing_by_name = {s.name: s for s in category.subjects}
        desired_names = set(payload.subjects)
        for subj_name, subject in existing_by_name.items():
            if subj_name not in desired_names:
                # A subject's own pose variations are meaningless once it's
                # gone — without this they were left behind as orphans
                # (subject_id pointing at a now-deleted row), which is why
                # variation_count never went back to 0 after removing a
                # category's last subject.
                for variation in list(category.variations):
                    if variation.subject_id == subject.id:
                        db.delete(variation)
                db.delete(subject)
        for subj_name in payload.subjects:
            if subj_name not in existing_by_name:
                new_subject = Subject(category_id=category.id, name=subj_name)
                db.add(new_subject)
                new_subjects.append(new_subject)
        db.flush()

    if payload.variations is not None:
        if payload.variations_subject_id is not None:
            # Scoped update: only this subject's own variations are
            # considered for the diff — every other subject's variations,
            # and the shared (subject_id IS NULL) pool, are left
            # completely untouched.
            relevant_variations = [v for v in category.variations if v.subject_id == payload.variations_subject_id]
        else:
            # Unscoped update — original, flat, category-wide behavior.
            relevant_variations = list(category.variations)

        existing_by_text = {v.text: v for v in relevant_variations}
        desired_texts = set(payload.variations)
        for text, variation in existing_by_text.items():
            if text not in desired_texts:
                db.delete(variation)
        db.flush()
        for i, text in enumerate(payload.variations):
            if text in existing_by_text:
                existing_by_text[text].order = i
            else:
                new_variation = Variation(
                    category_id=category.id,
                    subject_id=payload.variations_subject_id,
                    text=text,
                    order=i,
                )
                db.add(new_variation)
                new_variations.append(new_variation)
        db.flush()

    # Auto-translate any genuinely new subjects/variations into every
    # language this category already has set up, so a user reviewing a
    # language later finds it already filled in.
    auto_translated = {}
    if new_subjects or new_variations:
        auto_translated = auto_translate_new_items(db, category, new_subjects, new_variations)

    db.commit()
    db.refresh(category)
    return _to_category_read(category, auto_translated)


@router.get("/{category_id}/deletion-info", response_model=CategoryDeletionInfo)
def category_deletion_info(category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(category_id, user, db)
    try:
        return get_category_deletion_info(db, category_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
@router.delete("/{category_id}", response_model=CategoryDeletionResult)
def delete_category(category_id: int, delete_files: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(category_id, user, db)
    try:
        return delete_category_cascade(db, category_id, delete_files)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

 