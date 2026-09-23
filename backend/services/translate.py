from services.openai_client import get_openai_client

TRANSLATE_MODEL = "gpt-4o-mini"


LANGUAGE_NAMES = {
    "en": "English",
    "he": "Hebrew",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ar": "Arabic",
    "pt": "Portuguese",
    "it": "Italian",
    "ru": "Russian",
    "ja": "Japanese",
    "zh": "Chinese",
}


def translate_phrases(phrases: list[str], target_lang: str) -> dict[str, str]:
    if not phrases:
        return {}

    if target_lang.lower() == "en":
        # The source text IS English already — asking the model to
        # "translate English into English" is a degenerate request that
        # produces unwanted stylistic rewrites (e.g. "Cute Butterfly" ->
        # "Adorable Butterfly") instead of a no-op. Same reasoning as
        # translate_template_structure_for_book's existing en shortcut.
        return {phrase: phrase for phrase in phrases}

    language_name = LANGUAGE_NAMES.get(target_lang.lower(), target_lang)

    numbered = "\n".join(f"{i+1}. {p}" for i, p in enumerate(phrases))
    prompt = (
        f"Translate each of these {len(phrases)} short phrases into {language_name}. "
        f"These describe poses/angles for a children's coloring book illustration. "
        f"Keep translations short and natural, matching the style of the original. "
        f"Respond with ONLY the numbered translations, one per line, in the same order, "
        f"no extra commentary:\n\n{numbered}"
    )

    client = get_openai_client()
    response = client.chat.completions.create(
        model=TRANSLATE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    raw = response.choices[0].message.content or ""
    lines = [line.strip() for line in raw.strip().splitlines() if line.strip()]

    result = {}
    for i, phrase in enumerate(phrases):
        if i < len(lines):
            line = lines[i]
            cleaned = line.split(".", 1)[-1].strip() if line[:1].isdigit() else line
            result[phrase] = cleaned
        else:
            result[phrase] = ""

    return result

def translate_template(text: str, target_lang: str) -> str:
    """Translates surrounding text while leaving {category}/{item}/{variant}
    tokens completely untouched — used for one-time template structure setup
    per language, not per category."""
    language_name = LANGUAGE_NAMES.get(target_lang.lower(), target_lang)

    prompt = (
        f"Translate the following text into {language_name}. "
        f"The text contains placeholder tokens like {{category}}, {{item}}, {{variant}} — "
        f"keep every such token EXACTLY as written, with the exact same braces and spelling, "
        f"do not translate or alter the tokens themselves, only translate the surrounding words. "
        f"Respond with ONLY the translated text, no explanation, no quotes:\n\n{text}"
    )
    client = get_openai_client()
    response = client.chat.completions.create(
        model=TRANSLATE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    return (response.choices[0].message.content or "").strip()


def translate_template_structure_for_book(product_noun: str, target_lang: str) -> dict[str, str]:
    """Translates a neutral template structure, using this specific Book's
    product noun, into a new language, once — the result becomes that
    Book+language's reusable default. If the target is English, the neutral
    templates ARE the English version already — asking an LLM to 'translate
    English into English' is a degenerate, unreliable request that can
    produce garbled mixed-language output, so we skip the call entirely."""
    neutral_templates = {
        "filename_template": "{category}-{item}",
        "alt_template": f"{{category}} {{item}} {product_noun}, free printable",
        "title_template": f"{{category}} {{item}} {product_noun}",
    }

    if target_lang.lower() == "en":
        return neutral_templates

    return {
        key: translate_template(text, target_lang)
        for key, text in neutral_templates.items()
    }

def auto_translate_new_items(db, category, new_subjects: list, new_variations: list) -> dict:
    """Called right after new subjects/variations are added to a Category.
    For every language the category already has a Translation set up for,
    automatically translates just the genuinely-new items and saves them —
    so a user reviewing that language later finds it already filled in,
    rather than needing to remember to visit and generate it manually.
    Returns {lang: {"subjects": [...], "variations": [...]}} — the newly
    auto-translated item names per language, for surfacing a real,
    reviewable notification rather than a silent background write."""
    from models import TranslationItem, VariationTranslationItem

    result = {}
    if not new_subjects and not new_variations:
        return result

    for translation in category.translations:
        if not translation.active:
            continue
        lang = translation.lang
        touched = {"subjects": [], "variations": []}

        if new_subjects:
            phrases = [s.name for s in new_subjects]
            translated = translate_phrases(phrases, lang)
            for subject in new_subjects:
                text = translated.get(subject.name, "")
                if text:
                    db.add(TranslationItem(
                        translation_id=translation.id, subject_id=subject.id,
                        translated_text=text, pending_review=True,
                    ))
                    touched["subjects"].append(subject.name)

        if new_variations:
            phrases = [v.text for v in new_variations]
            translated = translate_phrases(phrases, lang)
            for variation in new_variations:
                text = translated.get(variation.text, "")
                if text:
                    db.add(VariationTranslationItem(
                        translation_id=translation.id, variation_id=variation.id,
                        translated_text=text, pending_review=True,
                    ))
                    touched["variations"].append(variation.text)

        if touched["subjects"] or touched["variations"]:
            result[lang] = touched

    return result


def generate_all_translations_for_category(category_id: int) -> None:
    """Best-effort background job: creates a Translation (book-level
    filename/alt/title templates + a translated category name) for every
    language the account has ever added, for a freshly created category.

    Runs right after category creation (scheduled as a FastAPI background
    task, so it starts server-side and survives the request/page that
    triggered it) so a brand-new category is already set up in every
    language by the time someone opens its Language step or carries a
    preview image over to Generate — no manual "Generate all" click needed.

    Takes only `category_id`, not a `db` session — a background task runs
    after the request's own session may already be closed, so this opens
    and closes its own. Each language is committed independently and a
    failure on one is swallowed and skipped rather than aborting the rest,
    since this always runs unattended with no one to see an error.
    """
    from database import SessionLocal
    from models import Category, SupportedLanguage, Translation, LanguageTemplateDefault

    db = SessionLocal()
    try:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            return
        book = category.book
        existing_langs = {t.lang for t in category.translations}
        languages = db.query(SupportedLanguage).all()

        for lang_row in languages:
            lang = lang_row.code
            if lang in existing_langs:
                continue
            try:
                template_row = (
                    db.query(LanguageTemplateDefault)
                    .filter(LanguageTemplateDefault.book_id == book.id, LanguageTemplateDefault.lang == lang)
                    .first()
                )
                if template_row:
                    templates = {
                        "filename_template": template_row.filename_template,
                        "alt_template": template_row.alt_template,
                        "title_template": template_row.title_template,
                    }
                else:
                    templates = translate_template_structure_for_book(book.product_noun, lang)
                    db.add(LanguageTemplateDefault(
                        book_id=book.id,
                        lang=lang,
                        filename_template=templates["filename_template"],
                        alt_template=templates["alt_template"],
                        title_template=templates["title_template"],
                    ))

                translated_name = translate_phrases([category.name], lang).get(category.name, category.name)

                db.add(Translation(
                    category_id=category.id,
                    lang=lang,
                    category_translated=translated_name,
                    filename_template=templates["filename_template"],
                    alt_template=templates["alt_template"],
                    title_template=templates["title_template"],
                ))
                db.commit()
            except Exception:
                # Best-effort — one language failing (e.g. a transient API
                # error) shouldn't stop the rest, and there's no one
                # watching this run to retry it themselves. Language step
                # still shows a manual "Generate all"/per-language button
                # for whatever didn't make it.
                db.rollback()
                continue
    finally:
        db.close()