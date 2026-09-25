import os
import base64
import io
from PIL import Image
from services.prompt_knobs import get_book_knobs
from sqlalchemy.orm import Session

from services.openai_client import resolve_credential
from services.rate_limits import get_image_rate_limiter


from models import Category, Subject, Variation, Book, BookPreview, GenerationJob, GenerationImage



OUTPUT_DIR = "output"
COST_PER_IMAGE_USD = 0.007  # matches README's low-quality tier estimate


def build_task_list(
    db: Session,
    category_id: int,
    subject_names: list[str] | None,
    new_variations_per_subject: int,
    max_images: int | None,
    user_id: int,
) -> list[dict]:
    # Looked up by id, not name — the caller (routers/generation.py) already
    # resolved and validated the exact intended Category by id; re-resolving
    # by name here would silently pick a DIFFERENT category when two share
    # the same name in different books (names are only unique per-Book),
    # writing the generated images to the wrong category/book entirely.
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise ValueError(f"Category {category_id} not found")

    all_subjects = category.subjects
    if subject_names:
        wanted = set(subject_names)
        all_subjects = [s for s in all_subjects if s.name in wanted]

    variations = sorted(category.variations, key=lambda v: v.order)
    if not variations:
        raise ValueError(f"Category '{category.name}' has no variations defined")

    tasks = []
    for subject in all_subjects:
        existing_max = _get_existing_max_variation(category.id, subject.name)
        for i in range(new_variations_per_subject):
            variation_num = existing_max + i + 1
            modifier = variations[(variation_num - 1) % len(variations)]
            tasks.append({
                "category": category.name,
                "category_id": category.id,
                "subject": subject.name,
                "variation_number": variation_num,
                "variation_text": modifier.text,
                "base_prompt": category.effective_base_prompt,
                "knobs": get_book_knobs(category.book),
                "user_id": user_id,
            })

    if max_images:
        tasks = tasks[:max_images]

    return tasks


def _get_existing_max_variation(category_id: int, subject_name: str) -> int:
    """Mirrors get_next_variation_number() from the original script —
    scans existing files on disk to avoid overwriting a published subject."""
    import glob
    category_dir = os.path.join(OUTPUT_DIR, str(category_id))
    pattern = os.path.join(category_dir, f"{subject_name.lower().replace(' ', '_')}_v*.png")
    numbers = []
    for f in glob.glob(pattern):
        try:
            numbers.append(int(f.split("_v")[-1].replace(".png", "")))
        except ValueError:
            continue
    return max(numbers) if numbers else 0


def build_task_list_from_pairs(db: Session, category_id: int, pairs: list[dict], user_id: int) -> list[dict]:
    # See build_task_list's comment above — looked up by id for the same
    # reason: a name-based re-lookup can silently resolve to a different,
    # same-named category in another book.
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise ValueError(f"Category {category_id} not found")

    from services.prompt_knobs import get_book_knobs

    counters: dict[str, int] = {}
    tasks = []
    for pair in pairs:
        subject_name = pair["subject"]
        if subject_name not in counters:
            counters[subject_name] = _get_existing_max_variation(category.id, subject_name)
        counters[subject_name] += 1

        tasks.append({
            "category": category.name,
            "category_id": category.id,
            "subject": subject_name,
            "variation_number": counters[subject_name],
            "variation_text": pair["variation_text"],
            "base_prompt": category.effective_base_prompt,
            "knobs": get_book_knobs(category.book),
            "user_id": user_id,
        })
    return tasks


def get_pair_generation_counts(db: Session, category_id: int) -> dict[str, int]:
    """Returns {'Car|jumping over a puddle': 2, ...} — how many times each
    exact subject+variation pair has actually been generated, queried
    from real GenerationImage rows (not a filename glob), so it reflects
    reality even across multiple separate batches.

    Filtered by category_id, not the category name string — category
    names are only unique per-Book, not globally (e.g. two different
    books can each have their own "test3" category), so matching by name
    alone would count another category's images as this one's, exactly
    like the cross-Book mixing bug already called out in
    services/review.get_images_for_category."""
    from models import GenerationImage
    rows = (
        db.query(GenerationImage.subject, GenerationImage.variation_text)
        .filter(GenerationImage.category_id == category_id)
        .all()
    )
    counts: dict[str, int] = {}
    for subject, variation_text in rows:
        key = f"{subject}|{variation_text}"
        counts[key] = counts.get(key, 0) + 1
    return counts


def _promoted_preview_marker(preview_id: int) -> str:
    """The exact params_json a promotion job is tagged with — used both to
    write it and, via a LIKE-prefix scan, to find it again. json.dumps'
    default separators are stable across calls, so this string is a
    reliable, unique-enough marker without needing a real FK/column."""
    import json
    return json.dumps({"promoted_from_preview_id": preview_id})


def get_promoted_preview_map(db: Session, book_id: int) -> dict[int, int]:
    """{preview_id: generation_image_id} for every preview in this book
    that's already been carried over to a category's real images —
    lets the preview UI grey out "Use this as the final image" for one
    that's already been promoted, instead of allowing a duplicate."""
    import json

    preview_ids = [pid for (pid,) in db.query(BookPreview.id).filter(BookPreview.book_id == book_id).all()]
    if not preview_ids:
        return {}

    jobs = (
        db.query(GenerationJob)
        .filter(GenerationJob.params_json.like('{"promoted_from_preview_id":%'))
        .all()
    )
    result: dict[int, int] = {}
    for job in jobs:
        try:
            preview_id = json.loads(job.params_json).get("promoted_from_preview_id")
        except (ValueError, AttributeError):
            continue
        if preview_id in preview_ids and job.images:
            result[preview_id] = job.images[0].id
    return result


def promote_preview_to_image(db: Session, book_id: int, preview_id: int, user_id: int) -> dict:
    """Turns an already-generated settings preview into a real, permanent
    generated image for its category, instead of running a second
    (billed, and not guaranteed identical) generation. This is safe
    because a preview already ran the exact same pipeline as a real
    generation (see generate_preview_image's docstring) — it's a genuine
    generated image that just wasn't filed under the category yet.

    If the preview was made with different settings than the book
    currently has saved (e.g. the user is promoting an older preview from
    before they kept tweaking the sliders), the book's settings are
    updated to match it — the winning preview becomes the new baseline
    for every future generation too, not just this one image.

    Idempotent: promoting the same preview twice (double-click, a stale
    page reloaded and retried, etc.) returns the SAME image instead of
    creating a duplicate file + GenerationImage row."""
    preview = db.query(BookPreview).filter(BookPreview.id == preview_id, BookPreview.book_id == book_id).first()
    if not preview:
        raise ValueError(f"Preview {preview_id} not found for book {book_id}")

    existing_job = (
        db.query(GenerationJob)
        .filter(GenerationJob.params_json == _promoted_preview_marker(preview.id))
        .first()
    )
    if existing_job and existing_job.images:
        existing_image = existing_job.images[0]
        return {
            "image_id": existing_image.id,
            "category_id": existing_image.category_id,
            "subject": existing_image.subject,
            "variation_text": existing_image.variation_text,
            "settings_updated": False,
            "already_promoted": True,
        }

    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise ValueError(f"Book {book_id} not found")

    category = next((c for c in book.categories if c.name == preview.category), None)
    if not category:
        raise ValueError(f"Category '{preview.category}' no longer exists in this book")

    subject = next((s for s in category.subjects if s.name == preview.subject), None)
    if not subject:
        raise ValueError(f"Subject '{preview.subject}' no longer exists in category '{preview.category}'")

    if not os.path.exists(preview.file_path):
        raise ValueError("The preview's image file is missing on disk")

    # Same numbering scheme real generation uses (_get_existing_max_variation
    # scans the category's own output files), so this slots in as if it had
    # been generated through the normal flow.
    variation_number = _get_existing_max_variation(category.id, subject.name) + 1
    category_dir = os.path.join(OUTPUT_DIR, str(category.id))
    os.makedirs(category_dir, exist_ok=True)
    filename = f"{subject.name.lower().replace(' ', '_')}_v{variation_number:03d}.png"
    output_path = os.path.join(category_dir, filename)

    import shutil
    shutil.copyfile(preview.file_path, output_path)

    job = GenerationJob(
        category=category.name,
        params_json=_promoted_preview_marker(preview.id),
        status="done",
        total_images=1,
        completed_images=1,
    )
    db.add(job)
    db.flush()

    image = GenerationImage(
        job_id=job.id,
        category=category.name,
        category_id=category.id,
        subject=subject.name,
        variation_number=variation_number,
        variation_text=preview.variation_text,
        file_path=output_path,
        prompt_used=preview.prompt_used,
        compiled_prompt_json=preview.compiled_prompt_json,
    )
    db.add(image)

    settings_updated = False
    preview_settings = {
        "canvas_width": preview.canvas_width,
        "canvas_height": preview.canvas_height,
        "subject_size_ratio": preview.subject_size_ratio,
        "white_clean_threshold": preview.white_clean_threshold,
        "black_clean_threshold": preview.black_clean_threshold,
        "palette_colors": preview.palette_colors,
    }
    for field, value in preview_settings.items():
        if getattr(book, field) != value:
            setattr(book, field, value)
            settings_updated = True

    db.commit()
    db.refresh(image)

    # Best-effort, same as the real generation path (job_runner.py) — SEO
    # auto-drafting is a convenience, never worth failing an already-saved
    # image over.
    try:
        from services.content_variants import auto_generate_seo_for_all_languages
        auto_generate_seo_for_all_languages(db, category.id, subject.name, preview.variation_text, user_id)
    except Exception:
        pass

    return {
        "image_id": image.id,
        "category_id": category.id,
        "subject": subject.name,
        "variation_text": preview.variation_text,
        "settings_updated": settings_updated,
        "already_promoted": False,
    }


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


def get_category_preview_options(db: Session, book_id: int, category_name: str, subject_name: str | None = None) -> dict:
    """Every subject in this category, and the variations available for the
    preview UI's dropdowns. Variations are scoped to `subject_name` when
    given — matching how variations are actually stored per-subject
    (PrepareCategoryPanel's own list does the same subject_id filter) —
    rather than the old flat, category-wide list that mixed every
    subject's variations together."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        return {"subjects": [], "variations": []}
    category = next((c for c in book.categories if c.name == category_name), None)
    if not category:
        return {"subjects": [], "variations": []}

    subject = None
    if subject_name is not None:
        subject = next((s for s in category.subjects if s.name == subject_name), None)

    if subject is not None:
        relevant_variations = [v for v in category.variations if v.subject_id == subject.id]
    elif subject_name is not None:
        # A subject name was given but doesn't exist (e.g. stale selection) —
        # there's nothing valid to scope to, so show no variations rather
        # than falling back to the old mixed-together list.
        relevant_variations = []
    else:
        # No subject specified at all — keep the original flat behavior for
        # any other caller that still wants the category-wide list.
        relevant_variations = list(category.variations)

    return {
        "subjects": [s.name for s in category.subjects],
        "variations": [v.text for v in sorted(relevant_variations, key=lambda v: v.order)],
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
    # Base the subject's max size on the canvas's SHORTER side, not always
    # canvas_height. On a portrait canvas (the normal case), canvas_width is
    # shorter, so basing this on height let the resized subject grow wider
    # than the page at ratios above ~0.7 — it got center-cropped when pasted
    # (see the negative-offset paste below). Using the shorter side means
    # subject_size_ratio == 1.0 always fits exactly inside the canvas, on
    # any orientation.
    max_subject_size = int(min(canvas_width, canvas_height) * settings["subject_size_ratio"])
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

def generate_image_file(task: dict, settings: dict, output_path: str) -> tuple[bool, str | None, str | None]:
    """Returns (success, prompt_used, compiled_prompt_json) — the caller
    needs the real prompt to persist it on GenerationImage. Stage 2 of
    the compiler rollout: the compiled, slot-separated prompt (Theme /
    Draw / Style / Rules) is now what's actually sent to the image API,
    replacing the old flat concatenation — confirmed via real side-by-
    side comparison to correctly prevent framing text from overriding
    fixed constraints like 'no color' on a coloring-page product.

    If task carries 'override_compiled' (a dict already in compile_prompt's
    shape), it's used as-is instead of recompiling from the book's
    CURRENT knobs — this is what lets Review's 'Regenerate' reuse the
    exact instructions that produced a specific rejected image, even if
    the book's knobs have since changed."""
    import json
    from services.prompt_knobs import compile_prompt
    if task.get("override_compiled"):
        compiled = task["override_compiled"]
    else:
        compiled = compile_prompt(
            task["base_prompt"],
            task["subject"],
            task["variation_text"],
            task["knobs"],
        )
    prompt = compiled["text"]
    compiled_json = json.dumps(compiled)

    try:
        client, credential_key = resolve_credential(task.get("user_id"))
        # Blocks until this credential's account-wide images/minute budget
        # (see services/rate_limits.py) has a free slot — matters here more
        # than anywhere else, since this is the loop that can fire many
        # calls back-to-back across a whole generation job.
        get_image_rate_limiter(credential_key).acquire()
        response = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size="1024x1024",
            quality="low",
        )
        image_bytes = base64.b64decode(response.data[0].b64_json)
        final = _process_raw_image(image_bytes, settings)
        final.save(output_path, "PNG", optimize=True, compress_level=9)
        return True, prompt, compiled_json
    except Exception as e:
        import traceback
        print(f"Error generating image: {e}")
        traceback.print_exc()
        return False, None, None

def build_regenerate_task(db: Session, image_id: int, user_id: int) -> dict:
    """Builds a single task for regenerating a rejected image using its
    OWN real, stored compiled slots — not a fresh compile from the
    book's current knobs. This is what makes Review's 'Regenerate' give
    the model the exact same instructions that produced the original
    image, so a reject/retry is a genuine second attempt at the same
    product, not a different request in disguise."""
    import json
    from models import GenerationImage

    image = db.query(GenerationImage).filter(GenerationImage.id == image_id).first()
    if not image:
        raise ValueError(f"Generation image {image_id} not found")
    if not image.compiled_prompt_json:
        raise ValueError("This image predates compiled-prompt tracking — use a normal regenerate instead.")
    if not image.category_id:
        raise ValueError("This image has no category_id on record — cannot safely regenerate.")

    category = db.query(Category).filter(Category.id == image.category_id).first()
    if not category:
        raise ValueError(f"Category {image.category_id} not found")

    compiled = json.loads(image.compiled_prompt_json)
    next_variation = _get_existing_max_variation(category.id, image.subject) + 1

    return {
        "category": category.name,
        "category_id": category.id,
        "subject": image.subject,
        "variation_number": next_variation,
        "variation_text": image.variation_text,
        "base_prompt": category.effective_base_prompt,  # unused when override_compiled is set, kept for shape consistency
        "knobs": {},  # same — override_compiled takes precedence in generate_image_file
        "override_compiled": compiled,
        "user_id": user_id,
    }


PREVIEW_DIR = "preview_cache"


def generate_preview_image(
    base_prompt: str,
    subject: str,
    variation_text: str,
    settings: dict,
    knobs: dict,
    user_id: int,
) -> tuple[bytes, str, str] | tuple[None, None, None]:
    """Runs a real, billed generation call using an actual subject + variation
    from the book's categories, so the preview matches genuine output exactly.
    Returns (raw PNG bytes, the exact prompt used, compiled_prompt_json) —
    the caller needs the prompt too, for accurate history tracking, and
    this is the one place that knows the real, final resolved string.
    Saving to disk + history is handled separately by the caller
    (save_preview_to_history). Stage 1 of the compiler rollout: the
    compiled, slot-separated prompt is built and recorded alongside the
    real prompt actually sent, for later comparison — see
    generate_image_file for the same pattern on real generation."""
    import json
    from services.prompt_knobs import compile_prompt
    compiled = compile_prompt(base_prompt, subject, variation_text, knobs)
    prompt = compiled["text"]
    compiled_json = json.dumps(compiled)

    try:
        client, credential_key = resolve_credential(user_id)
        # Same rate-limited image budget as generate_image_file — a preview
        # is still a real, billed gpt-image-2 call and counts against the
        # same account-wide 5/minute cap.
        get_image_rate_limiter(credential_key).acquire()
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
        return buf.getvalue(), prompt, compiled_json
    except Exception as e:
        import traceback
        print(f"Error generating preview: {e}")
        traceback.print_exc()
        return None, None, None


def save_preview_to_history(
    db: Session,
    book_id: int,
    category: str,
    subject: str,
    variation_text: str,
    settings: dict,
    image_bytes: bytes,
    prompt_used: str | None = None,
    compiled_prompt_json: str | None = None,
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
        compiled_prompt_json=compiled_prompt_json,
        file_path=file_path,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
