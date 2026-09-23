"""Ownership checks for book/category-scoped resources.

Books are private per user (see the note on Book.user_id in models.py) —
every route that takes a book_id or category_id should look it up
through one of these helpers rather than querying Book/Category
directly, so a user can never read or modify another user's data by
guessing an id in the URL.

Raises 404 (not 403) on a mismatch — deliberately not distinguishing
"doesn't exist" from "exists but isn't yours", for the same reason
/auth/verify-credentials doesn't distinguish a bad email from a bad
password: it avoids leaking which ids belong to someone else."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import Book, Category, GenerationImage, GenerationJob, User


def get_owned_book(book_id: int, user: User, db: Session) -> Book:
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user.id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


def get_owned_category(category_id: int, user: User, db: Session) -> Category:
    category = (
        db.query(Category)
        .join(Book, Category.book_id == Book.id)
        .filter(Category.id == category_id, Book.user_id == user.id)
        .first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def get_owned_job(job_id: int, user: User, db: Session) -> GenerationJob:
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id, GenerationJob.user_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def get_owned_image(image_id: int, user: User, db: Session) -> GenerationImage:
    # Every image has a job_id (NOT NULL), and every job now has a user_id
    # (backfilled in the same migration that added it) — so a job's owner
    # is a reliable ownership signal even for images whose category_id is
    # NULL (pre-dates that column being added).
    image = (
        db.query(GenerationImage)
        .join(GenerationJob, GenerationImage.job_id == GenerationJob.id)
        .filter(GenerationImage.id == image_id, GenerationJob.user_id == user.id)
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image
