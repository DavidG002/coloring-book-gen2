from fastapi.responses import Response

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Book
from services.generation import generate_preview_image, get_sample_task_for_book, get_eligible_preview_categories
from schemas import BookCreate, BookUpdate, BookRead, BookSummary, BookPreviewRequest, BookPreviewAvailability

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=list[BookSummary])
def list_books(db: Session = Depends(get_db)):
    books = db.query(Book).all()
    return [
        BookSummary(id=b.id, name=b.name, category_count=len(b.categories))
        for b in books
    ]

@router.get("/{book_id}/preview-availability", response_model=BookPreviewAvailability)
def check_preview_availability(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    all_category_names = [c.name for c in book.categories]
    eligible = get_eligible_preview_categories(db, book_id)

    if not eligible:
        return BookPreviewAvailability(available=False, all_categories=all_category_names)

    task = get_sample_task_for_book(db, book_id)
    return BookPreviewAvailability(
        available=True,
        all_categories=all_category_names,
        eligible_categories=eligible,
        sample_subject=task["subject"] if task else None,
        sample_variation=task["variation_text"] if task else None,
        sample_category=task["category"] if task else None,
    )


@router.post("/{book_id}/preview")
def preview_book_settings(book_id: int, payload: BookPreviewRequest, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    task = get_sample_task_for_book(db, book_id, category_name=payload.category_name)
    if not task:
        raise HTTPException(
            status_code=400,
            detail="Add at least one subject and one variation to a category in this book first.",
        )

    image_bytes = generate_preview_image(
        book.base_prompt,
        task["subject"],
        task["variation_text"],
        {
            "canvas_width": payload.canvas_width,
            "canvas_height": payload.canvas_height,
            "subject_size_ratio": payload.subject_size_ratio,
            "white_clean_threshold": payload.white_clean_threshold,
            "black_clean_threshold": payload.black_clean_threshold,
            "palette_colors": payload.palette_colors,
        },
    )
    if image_bytes is None:
        raise HTTPException(status_code=500, detail="Failed to generate preview image")

    return Response(content=image_bytes, media_type="image/png")

@router.get("/{book_id}", response_model=BookRead)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
    return BookRead(
        id=book.id,
        name=book.name,
        base_prompt=book.base_prompt,
        canvas_width=book.canvas_width,
        canvas_height=book.canvas_height,
        subject_size_ratio=book.subject_size_ratio,
        white_clean_threshold=book.white_clean_threshold,
        black_clean_threshold=book.black_clean_threshold,
        palette_colors=book.palette_colors,
        category_count=len(book.categories),
    )


@router.post("", response_model=BookRead, status_code=201)
def create_book(payload: BookCreate, db: Session = Depends(get_db)):
    existing = db.query(Book).filter(Book.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Book '{payload.name}' already exists")

    book = Book(**payload.model_dump())
    db.add(book)
    db.commit()
    db.refresh(book)
    return BookRead(
        id=book.id,
        name=book.name,
        base_prompt=book.base_prompt,
        canvas_width=book.canvas_width,
        canvas_height=book.canvas_height,
        subject_size_ratio=book.subject_size_ratio,
        white_clean_threshold=book.white_clean_threshold,
        black_clean_threshold=book.black_clean_threshold,
        palette_colors=book.palette_colors,
        category_count=0,
    )


@router.put("/{book_id}", response_model=BookRead)
def update_book(book_id: int, payload: BookUpdate, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(book, key, value)

    db.commit()
    db.refresh(book)
    return BookRead(
        id=book.id,
        name=book.name,
        base_prompt=book.base_prompt,
        canvas_width=book.canvas_width,
        canvas_height=book.canvas_height,
        subject_size_ratio=book.subject_size_ratio,
        white_clean_threshold=book.white_clean_threshold,
        black_clean_threshold=book.black_clean_threshold,
        palette_colors=book.palette_colors,
        category_count=len(book.categories),
    )


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
    if book.categories:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete Book '{book.name}' — it still has {len(book.categories)} categories. Move or delete them first.",
        )
    db.delete(book)
    db.commit()
