import os
from fastapi.responses import Response, FileResponse

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import get_db
from models import Book, BookPreview
from services.generation import (
    generate_preview_image, get_sample_task_for_book, 
    get_eligible_preview_categories, save_preview_to_history,
    get_category_preview_options,
)
from schemas import BookCreate, BookUpdate, BookRead, BookSummary, BookPreviewRequest, BookPreviewAvailability, BookPreviewRead, BookDeletionInfo, BookDeletionResult, WatermarkSettings, WatermarkSettingsUpdate, CategoryPreviewOptions
from services.book_deletion import get_book_deletion_info, delete_book_cascade



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

    task = get_sample_task_for_book(
        db,
        book_id,
        category_name=payload.category_name,
        subject_name=payload.subject_name,
        variation_text=payload.variation_text,
    )
    if not task:
        raise HTTPException(
            status_code=400,
            detail="Add at least one subject and one variation to a category in this book first.",
        )

    settings = {
        "canvas_width": payload.canvas_width,
        "canvas_height": payload.canvas_height,
        "subject_size_ratio": payload.subject_size_ratio,
        "white_clean_threshold": payload.white_clean_threshold,
        "black_clean_threshold": payload.black_clean_threshold,
        "palette_colors": payload.palette_colors,
        "watermark_enabled": book.watermark_enabled,
        "watermark_book_id": book.id,
        "watermark_position": book.watermark_position,
        "watermark_opacity": book.watermark_opacity,
        "watermark_scale": book.watermark_scale,
    }

    from services.prompt_knobs import get_book_knobs
    from services.prompt_knobs import get_book_knobs
    image_bytes, prompt_used, compiled_prompt_json = generate_preview_image(
        book.base_prompt,
        task["subject"],
        task["variation_text"],
        settings,
        get_book_knobs(book),
    )
    if image_bytes is None:
        raise HTTPException(status_code=500, detail="Failed to generate preview image")
    save_preview_to_history(
        db, book_id, task["category"], task["subject"], task["variation_text"], settings, image_bytes,
        prompt_used=prompt_used,
        compiled_prompt_json=compiled_prompt_json,
    )

    return Response(content=image_bytes, media_type="image/png")


@router.get("/{book_id}/previews", response_model=list[BookPreviewRead])
def list_previews(book_id: int, db: Session = Depends(get_db)):
    previews = (
        db.query(BookPreview)
        .filter(BookPreview.book_id == book_id)
        .order_by(BookPreview.created_at.desc())
        .all()
    )
    return previews


@router.get("/previews/{preview_id}/file")
def get_preview_file(preview_id: int, db: Session = Depends(get_db)):
    preview = db.query(BookPreview).filter(BookPreview.id == preview_id).first()
    if not preview:
        raise HTTPException(status_code=404, detail="Preview not found")
    if not os.path.exists(preview.file_path):
        raise HTTPException(status_code=404, detail="Preview file missing on disk")
    return FileResponse(preview.file_path, media_type="image/png")

@router.get("/{book_id}/preview-options/{category_name}", response_model=CategoryPreviewOptions)
def get_category_preview_options_route(book_id: int, category_name: str, db: Session = Depends(get_db)):
    return get_category_preview_options(db, book_id, category_name)



@router.get("/{book_id}", response_model=BookRead)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
    return BookRead(
        id=book.id,
        name=book.name,
        base_prompt=book.base_prompt,
        product_noun=book.product_noun,
        canvas_width=book.canvas_width,
        canvas_height=book.canvas_height,
        subject_size_ratio=book.subject_size_ratio,
        white_clean_threshold=book.white_clean_threshold,
        black_clean_threshold=book.black_clean_threshold,
        palette_colors=book.palette_colors,
        category_count=len(book.categories),
        line_weight=book.line_weight,
        detail_density=book.detail_density,
        style_tone=book.style_tone,
        subject_treatment=book.subject_treatment,
        character_mood=book.character_mood,
        background_richness=book.background_richness,
        border_style=book.border_style,
        line_weight_enabled=book.line_weight_enabled,
        detail_density_enabled=book.detail_density_enabled,
        style_tone_enabled=book.style_tone_enabled,
        subject_treatment_enabled=book.subject_treatment_enabled,
        character_mood_enabled=book.character_mood_enabled,
        background_richness_enabled=book.background_richness_enabled,
        border_style_enabled=book.border_style_enabled,
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
        product_noun=book.product_noun,
        canvas_width=book.canvas_width,
        canvas_height=book.canvas_height,
        subject_size_ratio=book.subject_size_ratio,
        white_clean_threshold=book.white_clean_threshold,
        black_clean_threshold=book.black_clean_threshold,
        palette_colors=book.palette_colors,
        category_count=0,
        line_weight=book.line_weight,
        detail_density=book.detail_density,
        style_tone=book.style_tone,
        subject_treatment=book.subject_treatment,
        character_mood=book.character_mood,
        background_richness=book.background_richness,
        border_style=book.border_style,
        line_weight_enabled=book.line_weight_enabled,
        detail_density_enabled=book.detail_density_enabled,
        style_tone_enabled=book.style_tone_enabled,
        subject_treatment_enabled=book.subject_treatment_enabled,
        character_mood_enabled=book.character_mood_enabled,
        background_richness_enabled=book.background_richness_enabled,
        border_style_enabled=book.border_style_enabled,
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
        product_noun=book.product_noun,
        canvas_width=book.canvas_width,
        canvas_height=book.canvas_height,
        subject_size_ratio=book.subject_size_ratio,
        white_clean_threshold=book.white_clean_threshold,
        black_clean_threshold=book.black_clean_threshold,
        palette_colors=book.palette_colors,
        category_count=len(book.categories),
        line_weight=book.line_weight,
        detail_density=book.detail_density,
        style_tone=book.style_tone,
        subject_treatment=book.subject_treatment,
        character_mood=book.character_mood,
        background_richness=book.background_richness,
        border_style=book.border_style,
        line_weight_enabled=book.line_weight_enabled,
        detail_density_enabled=book.detail_density_enabled,
        style_tone_enabled=book.style_tone_enabled,
        subject_treatment_enabled=book.subject_treatment_enabled,
        character_mood_enabled=book.character_mood_enabled,
        background_richness_enabled=book.background_richness_enabled,
        border_style_enabled=book.border_style_enabled,
    )


@router.get("/{book_id}/deletion-info", response_model=BookDeletionInfo)
def deletion_info(book_id: int, db: Session = Depends(get_db)):
    try:
        return get_book_deletion_info(db, book_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{book_id}", response_model=BookDeletionResult)
def delete_book(book_id: int, delete_files: bool = False, db: Session = Depends(get_db)):
    try:
        return delete_book_cascade(db, book_id, delete_files)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


WATERMARK_DIR = "watermarks"


@router.get("/{book_id}/watermark", response_model=WatermarkSettings)
def get_watermark_settings(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
    watermark_path = os.path.join(WATERMARK_DIR, f"{book_id}.png")
    return WatermarkSettings(
        watermark_enabled=book.watermark_enabled,
        watermark_position=book.watermark_position,
        watermark_opacity=book.watermark_opacity,
        watermark_scale=book.watermark_scale,
        has_watermark_file=os.path.exists(watermark_path),
    )


@router.put("/{book_id}/watermark", response_model=WatermarkSettings)
def update_watermark_settings(book_id: int, payload: WatermarkSettingsUpdate, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    if payload.watermark_enabled is not None:
        book.watermark_enabled = payload.watermark_enabled
    if payload.watermark_position is not None:
        book.watermark_position = payload.watermark_position
    if payload.watermark_opacity is not None:
        book.watermark_opacity = payload.watermark_opacity
    if payload.watermark_scale is not None:
        book.watermark_scale = payload.watermark_scale

    db.commit()

    watermark_path = os.path.join(WATERMARK_DIR, f"{book_id}.png")
    return WatermarkSettings(
        watermark_enabled=book.watermark_enabled,
        watermark_position=book.watermark_position,
        watermark_opacity=book.watermark_opacity,
        watermark_scale=book.watermark_scale,
        has_watermark_file=os.path.exists(watermark_path),
    )


@router.post("/{book_id}/watermark/upload", response_model=WatermarkSettings)
async def upload_watermark(book_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

    os.makedirs(WATERMARK_DIR, exist_ok=True)
    watermark_path = os.path.join(WATERMARK_DIR, f"{book_id}.png")

    from PIL import Image
    import io

    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded file as an image.")

    img.save(watermark_path, "PNG")

    return WatermarkSettings(
        watermark_enabled=book.watermark_enabled,
        watermark_position=book.watermark_position,
        watermark_opacity=book.watermark_opacity,
        watermark_scale=book.watermark_scale,
        has_watermark_file=True,
    )


@router.delete("/{book_id}/watermark", status_code=204)
def delete_watermark(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
    watermark_path = os.path.join(WATERMARK_DIR, f"{book_id}.png")
    if os.path.exists(watermark_path):
        os.remove(watermark_path)
