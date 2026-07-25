from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Book
from schemas import BookCreate, BookUpdate, BookRead, BookSummary

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=list[BookSummary])
def list_books(db: Session = Depends(get_db)):
    books = db.query(Book).all()
    return [
        BookSummary(id=b.id, name=b.name, category_count=len(b.categories))
        for b in books
    ]


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
