import os
import base64
import io
from PIL import Image
from sqlalchemy.orm import Session

from services.openai_client import get_openai_client

from models import Category, Subject, Variation, Book, BookPreview



OUTPUT_DIR = "output"
COST_PER_IMAGE_USD = 0.007  # matches README's low-quality tier estimate


def build_task_list(
    db: Session,
    category_name: str,
    subject_names: list[str] | None,
    new_variations_per_subject: int,
    max_images: int | None,
) -> list[dict]:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

    all_subjects = category.subjects
    if subject_names:
        wanted = set(subject_names)
        all_subjects = [s for s in all_subjects if s.name in wanted]

    variations = sorted(category.variations, key=lambda v: v.order)
    if not variations:
        raise ValueError(f"Category '{category_name}' has no variations defined")

    tasks = []
    for subject in all_subjects:
        existing_max = _get_existing_max_variation(category_name, subject.name)
        for i in range(new_variations_per_subject):
            variation_num = existing_max + i + 1
            modifier = variations[(variation_num - 1) % len(variations)]
            tasks.append({
                "category": category_name,
                "subject": subject.name,
                "variation_number": variation_num,
                "variation_text": modifier.text,
                "base_prompt": category.book.base_prompt,
                "line_weight": category.book.line_weight,
                "detail_density": category.book.detail_density,
                "style_tone": category.book.style_tone,
            })

    if max_images:
        tasks = tasks[:max_images]

    return tasks


def _get_existing_max_variation(category_name: str, subject_name: str) -> int:
    """Mirrors get_next_variation_number() from the original script —
    scans existing files on disk to avoid overwriting a published subject."""
    import glob
    category_dir = os.path.join(OUTPUT_DIR, category_name)
    pattern = os.path.join(category_dir, f"{subject_name.lower().replace(' ', '_')}_v*.png")
    existing = glob.glob(pattern)
    if not existing:
        return 0
    numbers = []
    for f in existing:
        try:
            numbers.append(int(f.split("_v")[-1].replace(".png", "")))
        except ValueError:
            continue
    return max(numbers) if numbers else 0


def get_sample_task_for_book(
    db: Session,
    book_id: int,
    category_name: str | None = None,
    subject_name: str | None = None,
    variation_text: str | None = None,
) -> dict | None:
    """Finds a subject+variation combination from this book's categories, to
    use for a settings preview. If subject_name/variation_text are given,
    uses those exact values (letting the user deliberately test a specific
    combination rather than always getting the auto-picked first one). If
    category_name is given without an explicit subject/variation, uses that
    category's first eligible pair. Returns None if nothing eligible."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        return None

    candidates = book.categories
    if category_name:
        candidates = [c for c in candidates if c.name == category_name]

    for category in candidates:
        if not (category.subjects and category.variations):
            continue

        if subject_name and variation_text:
            subject_match = next((s for s in category.subjects if s.name == subject_name), None)
            variation_match = next((v for v in category.variations if v.text == variation_text), None)
            if subject_match and variation_match:
                return {
                    "category": category.name,
                    "subject": subject_match.name,
                    "variation_text": variation_match.text,
                }
            continue

        subject = category.subjects[0]
        variation = sorted(category.variations, key=lambda v: v.order)[0]
        return {
            "category": category.name,
            "subject": subject.name,
            "variation_text": variation.text,
        }
    return None


def get_category_preview_options(db: Session, book_id: int, category_name: str) -> dict:
    """Every subject and variation available in this category, for the
    preview UI's dropdowns."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        return {"subjects": [], "variations": []}
    category = next((c for c in book.categories if c.name == category_name), None)
    if not category:
        return {"subjects": [], "variations": []}
    return {
        "subjects": [s.name for s in category.subjects],
        "variations": [v.text for v in sorted(category.variations, key=lambda v: v.order)],
    }

def get_eligible_preview_categories(db: Session, book_id: int) -> list[str]:
    """Categories in this book that have at least one subject and one
    variation — i.e. could actually be used for a settings preview."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        return []
    return [c.name for c in book.categories if c.subjects and c.variations]


WATERMARK_DIR = "watermarks"
WATERMARK_MARGIN_RATIO = 0.03  # margin from canvas edge, as a fraction of canvas width


def _apply_watermark(base_image, book_id: int, position: str, opacity: float, scale: float):
    """Composites a Book's logo onto an already-finished image, in full
    color — applied AFTER palette quantization so the logo's own colors
    are never crushed into the line art's small shared palette."""
    watermark_path = os.path.join(WATERMARK_DIR, f"{book_id}.png")
    canvas_rgba = base_image.convert("RGBA")

    if not os.path.exists(watermark_path):
        return canvas_rgba

    logo = Image.open(watermark_path).convert("RGBA")

    canvas_width, canvas_height = canvas_rgba.size
    target_width = max(1, int(canvas_width * scale))
    logo_ratio = logo.height / logo.width
    target_height = max(1, int(target_width * logo_ratio))
    logo = logo.resize((target_width, target_height), Image.LANCZOS)

    if opacity < 1.0:
        alpha = logo.getchannel("A").point(lambda a: int(a * opacity))
        logo.putalpha(alpha)

    margin = int(canvas_width * WATERMARK_MARGIN_RATIO)
    positions = {
        "bottom-right": (canvas_width - target_width - margin, canvas_height - target_height - margin),
        "bottom-left": (margin, canvas_height - target_height - margin),
        "top-right": (canvas_width - target_width - margin, margin),
        "top-left": (margin, margin),
    }
    paste_xy = positions.get(position, positions["bottom-right"])

    canvas_rgba.paste(logo, paste_xy, mask=logo)
    return canvas_rgba


def _process_raw_image(image_bytes: bytes, settings: dict):
    """Shared resize/cleanup/palette pipeline — used by both real generation
    and settings preview, so they can never silently drift apart. The
    watermark, if configured, is applied AFTER palette quantization so its
    own colors stay clean rather than being crushed into the line art's
    small shared palette."""
    image = Image.open(io.BytesIO(image_bytes))

    canvas_width = settings["canvas_width"]
    canvas_height = settings["canvas_height"]
    max_subject_size = int(canvas_height * settings["subject_size_ratio"])
    image.thumbnail((max_subject_size, max_subject_size), Image.LANCZOS)

    gray = image.convert("L")
    white_t = settings["white_clean_threshold"]
    black_t = settings["black_clean_threshold"]
    clean_lut = [0 if v < black_t else (255 if v > white_t else v) for v in range(256)]
    cleaned = gray.point(clean_lut, mode="L")

    canvas = Image.new("L", (canvas_width, canvas_height), 255)
    x = (canvas_width - cleaned.width) // 2
    y = (canvas_height - cleaned.height) // 2
    canvas.paste(cleaned, (x, y))

    final = canvas.convert("P", palette=Image.ADAPTIVE, colors=settings["palette_colors"], dither=Image.NONE)

    if settings.get("watermark_enabled") and settings.get("watermark_book_id"):
        final = _apply_watermark(
            final,
            book_id=settings["watermark_book_id"],
            position=settings.get("watermark_position", "bottom-right"),
            opacity=settings.get("watermark_opacity", 0.6),
            scale=settings.get("watermark_scale", 0.15),
        )

    return final

def generate_image_file(task: dict, settings: dict, output_path: str) -> bool:
    from services.prompt_knobs import build_full_prompt
    prompt = build_full_prompt(
        task["base_prompt"],
        task["subject"],
        task["variation_text"],
        task.get("line_weight", "medium"),
        task.get("detail_density", "moderate"),
        task.get("style_tone", "balanced"),
    )

    try:
        client = get_openai_client()
        response = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size="1024x1024",
            quality="low",
        )
        image_bytes = base64.b64decode(response.data[0].b64_json)
        final = _process_raw_image(image_bytes, settings)
        final.save(output_path, "PNG", optimize=True, compress_level=9)
        return True

    except Exception as e:
        import traceback
        print(f"Error generating image: {e}")
        traceback.print_exc()
        return False


PREVIEW_DIR = "preview_cache"


def generate_preview_image(
    base_prompt: str,
    subject: str,
    variation_text: str,
    settings: dict,
    line_weight: str = "medium",
    detail_density: str = "moderate",
    style_tone: str = "balanced",
) -> tuple[bytes, str] | tuple[None, None]:
    """Runs a real, billed generation call using an actual subject + variation
    from the book's categories, so the preview matches genuine output exactly.
    Returns (raw PNG bytes, the exact prompt used) — the caller needs the
    prompt too, for accurate history tracking, and this is the one place
    that knows the real, final resolved string. Saving to disk + history is
    handled separately by the caller (save_preview_to_history)."""
    from services.prompt_knobs import build_full_prompt
    prompt = build_full_prompt(base_prompt, subject, variation_text, line_weight, detail_density, style_tone)

    try:
        client = get_openai_client()
        response = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size="1024x1024",
            quality="low",
        )
        image_bytes = base64.b64decode(response.data[0].b64_json)
        final = _process_raw_image(image_bytes, settings)

        buf = io.BytesIO()
        final.save(buf, "PNG")
        return buf.getvalue(), prompt

    except Exception as e:
        import traceback
        print(f"Error generating preview: {e}")
        traceback.print_exc()
        return None, None


def save_preview_to_history(
    db: Session,
    book_id: int,
    category: str,
    subject: str,
    variation_text: str,
    settings: dict,
    image_bytes: bytes,
    prompt_used: str | None = None,
) -> "BookPreview":
    """Writes a generated preview image to disk and records it in history,
    so paid-for previews are never silently discarded."""
    from models import BookPreview
    import time

    book_dir = os.path.join(PREVIEW_DIR, str(book_id))
    os.makedirs(book_dir, exist_ok=True)
    filename = f"preview_{int(time.time() * 1000)}.png"
    file_path = os.path.join(book_dir, filename)

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    record = BookPreview(
        book_id=book_id,
        category=category,
        subject=subject,
        variation_text=variation_text,
        canvas_width=settings["canvas_width"],
        canvas_height=settings["canvas_height"],
        subject_size_ratio=settings["subject_size_ratio"],
        white_clean_threshold=settings["white_clean_threshold"],
        black_clean_threshold=settings["black_clean_threshold"],
        palette_colors=settings["palette_colors"],
        prompt_used=prompt_used,
        file_path=file_path,

    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
