from sqlalchemy.orm import Session
from services.openai_client import get_openai_client
from services.translate import LANGUAGE_NAMES
from models import Subject, Variation, ContentVariant, Category


def generate_content_variant(
    book_base_prompt: str,
    category_name: str,
    subject_name: str,
    variation_text: str,
    lang: str,
) -> dict:
    """One LLM call produces natural, SEO-oriented title/alt/excerpt/content
    for a specific subject+variation, in the target language. Not a naive
    template concatenation — genuinely written, grammatical text. Style and
    audience come from the Book's own prompt, so tone stays correct whether
    this is a kids' coloring book, a teen stencil set, or anything else."""
    language_name = LANGUAGE_NAMES.get(lang.lower(), lang)

    prompt = f"""You are writing SEO metadata for an image on a website.
The site/book's style and intended audience is described as:
"{book_base_prompt}"

Subject: {subject_name}
Pose/scene description: {variation_text}
Category: {category_name}

Write natural, grammatically correct {language_name} for each of the following,
matching the style and audience described above. Do not just concatenate the
subject and pose — write real sentences a native speaker would use.

Respond with EXACTLY this format, one field per line, no extra commentary:
TITLE: <a short page title, e.g. "Car Coloring Page \u2014 Side View on a Road">
ALT: <a natural, descriptive alt-text sentence for accessibility and image search>
EXCERPT: <one short sentence summarizing the page, for use as a meta description>
CONTENT: <two to three short sentences of body text for the page, matching the site's tone>
"""

    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )

    raw = response.choices[0].message.content or ""
    result = {"seo_title": "", "seo_alt_text": "", "seo_excerpt": "", "seo_content": ""}
    field_map = {"TITLE": "seo_title", "ALT": "seo_alt_text", "EXCERPT": "seo_excerpt", "CONTENT": "seo_content"}

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

    generated = generate_content_variant(category.book.base_prompt, category_name, subject_name, variation_text, lang)

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

def generate_category_description(book_base_prompt: str, category_name: str, translated_category_name: str, lang: str) -> str:
    """One short, natural-language description for a category's WordPress
    taxonomy term — generated once per (category, language), reused forever.
    Style/audience comes from the Book's own prompt, not a hardcoded assumption."""
    language_name = LANGUAGE_NAMES.get(lang.lower(), lang)

    prompt = f"""The site/book's style and intended audience is described as:
"{book_base_prompt}"

Write one short, natural {language_name} sentence (max 25 words) describing a
category called "{translated_category_name}" (in English: "{category_name}") on this site,
matching its style and audience. Respond with ONLY the sentence, no quotes, no explanation."""

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
    from models import CategoryDescription

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

    description = generate_category_description(category.book.base_prompt, category_name, translated_category_name, lang)

    record = CategoryDescription(category=category_name, lang=lang, description=description)
    db.add(record)
    db.commit()
    return description