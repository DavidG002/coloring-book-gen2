from unicodedata import category

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


def ensure_content_variant(
    db: Session,
    category_name: str,
    subject_name: str,
    variation_text: str,
    lang: str,
) -> ContentVariant:
    """Returns the cached ContentVariant if it exists, otherwise generates
    and stores it once — every future image using this same subject,
    variation, and language reuses it for free."""
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

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


def ensure_category_description(db: Session, category_name: str, translated_category_name: str, lang: str) -> str:
    """Returns the cached description if this category+language has one
    already; otherwise generates and stores it once."""
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

    existing = (
        db.query(CategoryDescription)
        .filter(CategoryDescription.category == category_name, CategoryDescription.lang == lang)
        .first()
    )
    if existing:
        return existing.description

    description = generate_category_description(category.book.base_prompt, category.book.product_noun, category_name, translated_category_name, lang)
    
    record = CategoryDescription(category=category_name, lang=lang, description=description)
    db.add(record)
    db.commit()
    return description
def regenerate_content_variant(
    db: Session,
    category_name: str,
    subject_name: str,
    variation_text: str,
    lang: str,
) -> ContentVariant:
    """Forces a fresh generation even if one is already cached — the fix
    for when the existing AI-written copy is wrong and needs a redo."""
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")
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


def list_content_variants(db: Session, category_name: str, lang: str) -> list[dict]:
    """Only subject×variation pairings that have at least one real, approved
    (non-rejected) generated image — not the full theoretical cross-product.
    A pairing with no approved images yet has nothing to publish, so it has
    no reason to appear in the SEO list. Each row includes a real image_id
    to source a genuine thumbnail from, rather than being purely abstract
    text. Content itself is still cached per (subject, variation, lang) —
    multiple approved images sharing a pairing correctly share one set of
    SEO content, since they depict the same thing."""
    from models import GenerationImage

    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

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


def regenerate_category_description(db: Session, category_name: str, translated_category_name: str, lang: str) -> str:
    category = db.query(Category).filter(Category.name == category_name).first()
    if not category:
        raise ValueError(f"Category '{category_name}' not found")

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