import os
import shutil
import glob
from sqlalchemy.orm import Session

from models import (
    Book, Category, GenerationJob, GenerationImage,
    PublishRun, PublishedFile, WordPressPublishedItem, WordPressCategoryTerm,
    CategoryDescription, LanguageTemplateDefault,
)

OUTPUT_DIR = "output"
PUBLISH_DIR = "publish"
PREVIEW_DIR = "preview_cache"


def get_book_deletion_info(db: Session, book_id: int) -> dict:
    """Real counts of what exists under this book, so the user can see the
    actual impact before choosing how to delete it."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise ValueError(f"Book {book_id} not found")

    categories_info = []
    total_images = 0
    has_wordpress_content = False

    for category in book.categories:
        image_count = db.query(GenerationImage).filter(GenerationImage.category == category.name).count()
        published_count = (
            db.query(PublishedFile.source_path)
            .join(PublishRun, PublishedFile.run_id == PublishRun.id)
            .filter(PublishRun.category == category.name)
            .distinct()
            .count()
        )
        wp_draft = db.query(WordPressPublishedItem).filter(
            WordPressPublishedItem.category == category.name, WordPressPublishedItem.status == "draft"
        ).count()
        wp_live = db.query(WordPressPublishedItem).filter(
            WordPressPublishedItem.category == category.name, WordPressPublishedItem.status == "publish"
        ).count()

        if wp_draft or wp_live:
            has_wordpress_content = True

        categories_info.append({
            "name": category.name,
            "image_count": image_count,
            "locally_published_count": published_count,
            "wordpress_draft_count": wp_draft,
            "wordpress_live_count": wp_live,
        })
        total_images += image_count

    return {
        "book_name": book.name,
        "categories": categories_info,
        "total_images": total_images,
        "has_wordpress_content": has_wordpress_content,
    }


def delete_book_cascade(db: Session, book_id: int, delete_files: bool) -> dict:
    """Deletes a book and every category inside it. Configuration (categories,
    subjects, variations, translations, local bookkeeping) is always removed.
    Actual generated files and local publish history are only removed if
    delete_files is True. WordPress content is NEVER touched — that data
    lives on a real external site and must be removed there manually."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise ValueError(f"Book {book_id} not found")

    category_names = [c.name for c in book.categories]
    deleted_files_count = 0

    for category_name in category_names:
        # Local WordPress bookkeeping (not the actual WordPress content —
        # just our own record of what we pushed) is always cleared, since
        # it becomes meaningless once the category itself is gone.
        db.query(WordPressPublishedItem).filter(WordPressPublishedItem.category == category_name).delete()
        db.query(WordPressCategoryTerm).filter(WordPressCategoryTerm.category == category_name).delete()
        db.query(CategoryDescription).filter(CategoryDescription.category == category_name).delete()

        if delete_files:
            # Remove actual generated image files
            category_output_dir = os.path.join(OUTPUT_DIR, category_name)
            if os.path.isdir(category_output_dir):
                deleted_files_count += sum(len(files) for _, _, files in os.walk(category_output_dir))
                shutil.rmtree(category_output_dir, ignore_errors=True)

            # Remove published copies + manifests across every language folder
            for publish_lang_dir in glob.glob(os.path.join(PUBLISH_DIR, "*", category_name)):
                shutil.rmtree(publish_lang_dir, ignore_errors=True)

            # Remove local publish history records for this category
            run_ids = [r.id for r in db.query(PublishRun).filter(PublishRun.category == category_name).all()]
            for run_id in run_ids:
                db.query(PublishedFile).filter(PublishedFile.run_id == run_id).delete()
            db.query(PublishRun).filter(PublishRun.category == category_name).delete()

            # Remove generation job/image history for this category
            job_ids = [j.id for j in db.query(GenerationJob).filter(GenerationJob.category == category_name).all()]
            db.query(GenerationImage).filter(GenerationImage.category == category_name).delete()
            for job_id in job_ids:
                db.query(GenerationJob).filter(GenerationJob.id == job_id).delete()

    # Preview-test images are disposable by design — always cleaned up with the book
    book_preview_dir = os.path.join(PREVIEW_DIR, str(book_id))
    if os.path.isdir(book_preview_dir):
        shutil.rmtree(book_preview_dir, ignore_errors=True)

    db.query(LanguageTemplateDefault).filter(LanguageTemplateDefault.book_id == book_id).delete()

    # Deleting each Category cascades to its subjects/variations/translations
    # (and their ContentVariant rows) via the existing FK cascade rules.
    for category in list(book.categories):
        db.delete(category)

    db.delete(book)
    db.commit()

    return {
        "categories_deleted": len(category_names),
        "files_deleted": delete_files,
        "deleted_file_count": deleted_files_count,
    }

def get_category_deletion_info(db: Session, category_id: int) -> dict:
    """Real counts for a single category, same shape as book-level info."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise ValueError(f"Category {category_id} not found")
    category_name = category.name

    image_count = db.query(GenerationImage).filter(GenerationImage.category == category_name).count()
    published_count = (
        db.query(PublishedFile.source_path)
        .join(PublishRun, PublishedFile.run_id == PublishRun.id)
        .filter(PublishRun.category == category_name)
        .distinct()
        .count()
    )
    wp_draft = db.query(WordPressPublishedItem).filter(
        WordPressPublishedItem.category == category_name, WordPressPublishedItem.status == "draft"
    ).count()
    wp_live = db.query(WordPressPublishedItem).filter(
        WordPressPublishedItem.category == category_name, WordPressPublishedItem.status == "publish"
    ).count()

    return {
        "category_name": category_name,
        "image_count": image_count,
        "locally_published_count": published_count,
        "wordpress_draft_count": wp_draft,
        "wordpress_live_count": wp_live,
        "has_wordpress_content": bool(wp_draft or wp_live),
    }


def delete_category_cascade(db: Session, category_id: int, delete_files: bool) -> dict:
    """Deletes one category. Configuration is always removed. Files and
    local publish history are only removed if delete_files is True.
    WordPress content is never touched, same rule as book deletion."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise ValueError(f"Category {category_id} not found")
    category_name = category.name

    db.query(WordPressPublishedItem).filter(WordPressPublishedItem.category == category_name).delete()
    db.query(WordPressCategoryTerm).filter(WordPressCategoryTerm.category == category_name).delete()
    db.query(CategoryDescription).filter(CategoryDescription.category == category_name).delete()

    deleted_file_count = 0
    if delete_files:
        category_output_dir = os.path.join(OUTPUT_DIR, category_name)
        if os.path.isdir(category_output_dir):
            deleted_file_count += sum(len(files) for _, _, files in os.walk(category_output_dir))
            shutil.rmtree(category_output_dir, ignore_errors=True)

        for publish_lang_dir in glob.glob(os.path.join(PUBLISH_DIR, "*", category_name)):
            shutil.rmtree(publish_lang_dir, ignore_errors=True)

        run_ids = [r.id for r in db.query(PublishRun).filter(PublishRun.category == category_name).all()]
        for run_id in run_ids:
            db.query(PublishedFile).filter(PublishedFile.run_id == run_id).delete()
        db.query(PublishRun).filter(PublishRun.category == category_name).delete()

        job_ids = [j.id for j in db.query(GenerationJob).filter(GenerationJob.category == category_name).all()]
        db.query(GenerationImage).filter(GenerationImage.category == category_name).delete()
        for job_id in job_ids:
            db.query(GenerationJob).filter(GenerationJob.id == job_id).delete()

    db.delete(category)
    db.commit()

    return {"files_deleted": delete_files, "deleted_file_count": deleted_file_count}