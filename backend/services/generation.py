import os
import base64
import io
from PIL import Image
from openai import OpenAI
from sqlalchemy.orm import Session

from models import Category, Subject, Variation

client = OpenAI()  # reads OPENAI_API_KEY from env automatically

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
                "base_prompt": category.base_prompt,
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


def generate_image_file(task: dict, settings: dict, output_path: str) -> bool:
    """Direct port of generate_image() from generate_pages.py, parameterized
    by settings instead of hardcoded constants."""
    prompt = task["base_prompt"] + f" Cute {task['subject']}. {task['variation_text']}."

    try:
        response = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size="1024x1024",
            quality="low",
        )
        image_bytes = base64.b64decode(response.data[0].b64_json)
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
        final.save(output_path, "PNG", optimize=True, compress_level=9)
        return True

    except Exception as e:
        import traceback
        print(f"Error generating image: {e}")
        traceback.print_exc()
        return False