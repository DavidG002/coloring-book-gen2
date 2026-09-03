from sqlalchemy.orm import Session
from services.openai_client import get_openai_client
from services.translate import LANGUAGE_NAMES
from models import Subject, Variation, ContentVariant, Category, CategoryDescription


def generate_content_variant(
    book_base_prompt: str,
    product_noun: str,
    category_name: str,
    subject_name: str,
    variation_text: str,
    lang: str,
) -> dict:
    language_name = LANGUAGE_NAMES.get(lang.lower(), lang)

    prompt = f"""You are writing SEO metadata for an image on a website.
The site/product is described as:
"{book_base_prompt}"
The product type is: {product_noun}

Subject: {subject_name}
Pose/scene description: {variation_text}
Category: {category_name}

Write natural, grammatically correct {language_name} for each of the following,
matching the style and audience described above, and consistently referring to
this as a "{product_noun}". Do not just concatenate the subject and pose \u2014
write real sentences a native speaker would use. Keep everything short, plain,
and concrete. Avoid vague or overselling marketing language (e.g. "captures the
essence," "invites viewers to appreciate," "a testament to"). State plainly
what the image shows.

Respond with EXACTLY this format, one field per line, no extra commentary:
TITLE: <a short page title>
ALT: <ONE natural, descriptive alt-text sentence for accessibility and image search>
EXCERPT: <ONE short, plain sentence, under 20 words, stating what the image shows>
CONTENT: <ONE to TWO short, plain sentences — mention the subject and category naturally for search visibility, no overselling>
KEYPHRASE: <a short 2-4 word search phrase someone would actually type to find this — the real focus keyphrase for SEO, not a sentence>
YOAST_TITLE: <a search-engine title under 60 characters, starting with the keyphrase, distinct from TITLE which is the on-page heading>
META_DESC: <a compelling meta description under 155 characters, written to earn clicks in search results, naturally including the keyphrase>
"""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )

    raw = response.choices[0].message.content or ""
    result = {
        "seo_title": "", "seo_alt_text": "", "seo_excerpt": "", "seo_content": "",
        "focus_keyphrase": "", "yoast_title": "", "yoast_meta_description": "",
    }
    field_map = {
        "TITLE": "seo_title", "ALT": "seo_alt_text", "EXCERPT": "seo_excerpt", "CONTENT": "seo_content",
        "KEYPHRASE": "focus_keyphrase", "YOAST_TITLE": "yoast_title", "META_DESC": "yoast_meta_description",
    }

    for line in raw.strip().splitlines():
        for prefix, key in field_map.items():
            if line.strip().startswith(f"{prefix}:"):
                result[key] = line.split(":", 1)[1].strip()

    return result

FIELD_PROMPTS = {
    "seo_title": ("a short page title", "TITLE"),
    "seo_alt_text": ("ONE natural, descriptive alt-text sentence for accessibility and image search", "ALT"),
    "seo_excerpt": ("ONE short, plain sentence, under 20 words, stating what the image shows", "EXCERPT"),
    "seo_content": ("ONE to TWO short, plain sentences — mention the subject and category naturally for search visibility, no overselling", "CONTENT"),
    "focus_keyphrase": ("a short 2-4 word search phrase someone would actually type to find this — the real focus keyphrase for SEO, not a sentence", "KEYPHRASE"),
    "yoast_title": ("a search-engine title under 60 characters, starting with the keyphrase, distinct from the on-page heading", "YOAST_TITLE"),
    "yoast_meta_description": ("a compelling meta description under 155 characters, written to earn clicks in search results, naturally including the keyphrase", "META_DESC"),
}


def generate_single_field(
    book_base_prompt: str,
    product_noun: str,
    category_name: str,
    subject_name: str,
    variation_text: str,
    lang: str,
    field: str,
) -> str:
    """Regenerates exactly ONE SEO field, leaving every other field on the
    row completely untouched — the fix for 'one field has a mistake, but
    I don't want to risk changing the others, especially ones already
    live on WordPress.'"""
    if field not in FIELD_PROMPTS:
        raise ValueError(f"Unknown field '{field}'")

    description, response_prefix = FIELD_PROMPTS[field]
    language_name = LANGUAGE_NAMES.get(lang.lower(), lang)

    prompt = f"""You are writing ONE piece of SEO metadata for an image on a website.
The site/product is described as:
"{book_base_prompt}"
The product type is: {product_noun}

Subject: {subject_name}
Pose/scene description: {variation_text}
Category: {category_name}

Write natural, grammatically correct {language_name}, matching the style and
audience described above, and consistently referring to this as a
"{product_noun}". Do not just concatenate the subject and pose — write a
real sentence a native speaker would use. Keep it short, plain, and
concrete. Avoid vague or overselling marketing language.

Write {description}.

Respond with EXACTLY this format, no extra commentary:
{response_prefix}: <your answer>
"""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )

    raw = (response.choices[0].message.content or "").strip()
    prefix = f"{response_prefix}:"
    for line in raw.splitlines():
        if line.strip().startswith(prefix):
            return line.split(":", 1)[1].strip()
    return raw  # fallback: model didn't follow the format, use what it gave us

def regenerate_single_field(
    db: Session,
    category_id: int,
    subject_name: str,
    variation_text: str,
    lang: str,
    field: str,
) -> str:
    """Regenerates one field via the LLM, saves it, and returns the new
    value — every other field on this ContentVariant row is untouched."""
    category = _get_category_or_raise(db, category_id)

    subject = db.query(Subject).filter(Subject.category_id == category.id, Subject.name == subject_name).first()
    variation = db.query(Variation).filter(Variation.category_id == category.id, Variation.text == variation_text).first()
    if not subject or not variation:
        raise ValueError("Subject or variation not found")

    new_value = generate_single_field(
        category.book.base_prompt, category.book.product_noun, category.name,
        subject_name, variation_text, lang, field,
    )

    existing = (
        db.query(ContentVariant)
        .filter(ContentVariant.subject_id == subject.id, ContentVariant.variation_id == variation.id, ContentVariant.lang == lang)
        .first()
    )
    if not existing:
        raise ValueError("No existing content for this row — use the full Regenerate first.")

    setattr(existing, field, new_value)
    db.commit()
    return new_value


def _get_category_or_raise(db: Session, category_id: int) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise ValueError(f"Category {category_id} not found")
    return category


def ensure_content_variant(
    db: Session,
    category_id: int,
    subject_name: str,
    variation_text: str,
    lang: str,
) -> ContentVariant:
    """Returns the cached ContentVariant if it exists, otherwise generates
    and stores it once — every future image using this same subject,
    variation, and language reuses it for free."""
    category = _get_category_or_raise(db, category_id)
    category_name = category.name

    subject = db.query(Subject).filter(Subject.category_id == category.id, Subject.name == subject_name).first()
    if not subject:
        raise ValueError(f"Subject '{subject_name}' not found in '{category_name}'")

    variation = db.query(Variation).filter(Variation.category_id == category.id, Variation.text == variation_text).first()
    if not variation:
        raise ValueError(f"Variation '{variation_text}' not found in '{category_name}'")

    existing = (
        db.query(ContentVariant)
        .filter(ContentVariant.subject_id == subject.id, ContentVariant.variation_id == variation.id, ContentVariant.lang == lang)
        .first()
    )
    if existing:
        return existing

    generated = generate_content_variant(category.book.base_prompt, category.book.product_noun, category_name, subject_name, variation_text, lang)

    record = ContentVariant(
        subject_id=subject.id,
        variation_id=variation.id,
        lang=lang,
        **generated,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def generate_category_description(book_base_prompt: str, product_noun: str, category_name: str, translated_category_name: str, lang: str) -> str:
    language_name = LANGUAGE_NAMES.get(lang.lower(), lang)

    prompt = f"""The site/product is described as:
"{book_base_prompt}"
The product type is: {product_noun}

Write one short, plain {language_name} sentence (max 25 words) describing a
category called "{translated_category_name}" (in English: "{category_name}") on this
site, consistently referring to this as a "{product_noun}". Match the style and
audience described above. Avoid vague or overselling language. Respond with
ONLY the sentence, no quotes, no explanation."""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )
    return (response.choices[0].message.content or "").strip()


def ensure_category_description(db: Session, category_id: int, translated_category_name: str, lang: str) -> str:
    """Returns the cached description if this category+language has one
    already; otherwise generates and stores it once."""
    category = _get_category_or_raise(db, category_id)
    category_name = category.name

    existing = (
        db.query(CategoryDescription)
        .filter(CategoryDescription.category_id == category_id, CategoryDescription.lang == lang)
        .first()
    )
    if existing:
        return existing.description

    description = generate_category_description(category.book.base_prompt, category.book.product_noun, category_name, translated_category_name, lang)

    record = CategoryDescription(category=category_name, category_id=category_id, lang=lang, description=description)
    db.add(record)
    db.commit()
    return description


def regenerate_content_variant(
    db: Session,
    category_id: int,
    subject_name: str,
    variation_text: str,
    lang: str,
) -> ContentVariant:
    """Forces a fresh generation even if one is already cached — the fix
    for when the existing AI-written copy is wrong and needs a redo."""
    category = _get_category_or_raise(db, category_id)
    category_name = category.name

    subject = db.query(Subject).filter(Subject.category_id == category.id, Subject.name == subject_name).first()
    variation = db.query(Variation).filter(Variation.category_id == category.id, Variation.text == variation_text).first()
    if not subject or not variation:
        raise ValueError("Subject or variation not found")

    generated = generate_content_variant(category.book.base_prompt, category.book.product_noun, category_name, subject_name, variation_text, lang)

    existing = (
        db.query(ContentVariant)
        .filter(ContentVariant.subject_id == subject.id, ContentVariant.variation_id == variation.id, ContentVariant.lang == lang)
        .first()
    )
    if existing:
        existing.seo_title = generated["seo_title"]
        existing.seo_alt_text = generated["seo_alt_text"]
        existing.seo_excerpt = generated["seo_excerpt"]
        existing.seo_content = generated["seo_content"]
        existing.focus_keyphrase = generated["focus_keyphrase"]
        existing.yoast_title = generated["yoast_title"]
        existing.yoast_meta_description = generated["yoast_meta_description"]
        db.commit()
        db.refresh(existing)
        return existing

    record = ContentVariant(subject_id=subject.id, variation_id=variation.id, lang=lang, **generated)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_content_variants(db: Session, category_id: int, lang: str) -> list[dict]:
    """Only subject×variation pairings that have at least one real, approved
    (non-rejected) generated image — not the full theoretical cross-product.
    A pairing with no approved images yet has nothing to publish, so it has
    no reason to appear in the SEO list. Each row includes a real image_id
    to source a genuine thumbnail from, rather than being purely abstract
    text. Content itself is still cached per (subject, variation, lang) —
    multiple approved images sharing a pairing correctly share one set of
    SEO content, since they depict the same thing."""
    from models import GenerationImage

    category = _get_category_or_raise(db, category_id)
    category_name = category.name

    # One representative approved image per (subject, variation_text) —
    # used both to confirm the pairing was actually generated and to give
    # the SEO list a real thumbnail to show.
    approved_images = (
        db.query(GenerationImage)
        .filter(GenerationImage.category == category_name, GenerationImage.status == "approved")
        .order_by(GenerationImage.created_at.asc())
        .all()
    )
    representative_image_by_pairing: dict[tuple[str, str], "GenerationImage"] = {}
    for img in approved_images:
        if not img.variation_text:
            continue  # legacy images with no recorded variation can't be matched to a pairing
        key = (img.subject, img.variation_text)
        if key not in representative_image_by_pairing:
            representative_image_by_pairing[key] = img

    rows = []
    for subject in category.subjects:
        for variation in sorted(category.variations, key=lambda v: v.order):
            key = (subject.name, variation.text)
            representative = representative_image_by_pairing.get(key)
            if not representative:
                continue  # nothing real generated for this pairing yet — skip it

            existing = (
                db.query(ContentVariant)
                .filter(ContentVariant.subject_id == subject.id, ContentVariant.variation_id == variation.id, ContentVariant.lang == lang)
                .first()
            )
            rows.append({
                "subject_name": subject.name,
                "variation_text": variation.text,
                "seo_title": existing.seo_title if existing else "",
                "seo_alt_text": existing.seo_alt_text if existing else "",
                "seo_excerpt": existing.seo_excerpt if existing else "",
                "seo_content": existing.seo_content if existing else "",
                "focus_keyphrase": (existing.focus_keyphrase or "") if existing else "",
                "yoast_title": (existing.yoast_title or "") if existing else "",
                "yoast_meta_description": (existing.yoast_meta_description or "") if existing else "",
                "generated": existing is not None,
                "sample_image_id": representative.id,
            })
    return rows


def regenerate_category_description(db: Session, category_id: int, translated_category_name: str, lang: str) -> str:
    category = _get_category_or_raise(db, category_id)
    category_name = category.name

    description = generate_category_description(category.book.base_prompt, category.book.product_noun, category_name, translated_category_name, lang)

    existing = (
        db.query(CategoryDescription)
        .filter(CategoryDescription.category == category_name, CategoryDescription.lang == lang)
        .first()
    )
    if existing:
        existing.description = description
        db.commit()
        return description
    record = CategoryDescription(category=category_name, lang=lang, description=description)
    db.add(record)
    db.commit()
    return description