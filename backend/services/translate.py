from services.openai_client import get_openai_client

TRANSLATE_MODEL = "gpt-4o-mini"


LANGUAGE_NAMES = {
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

    response = client.chat.completions.create(
        model=TRANSLATE_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    return (response.choices[0].message.content or "").strip()


NEUTRAL_TEMPLATES = {
    "filename_template": "coloring-page-{category}-{item}",
    "alt_template": "{category} {item} coloring page, free printable",
    "title_template": "{category} {item} coloring page",
}


def translate_template_structure(target_lang: str) -> dict[str, str]:
    """Translates the neutral English template structure into a new
    language, once — the result becomes that language's reusable default."""
    return {
        key: translate_template(text, target_lang)
        for key, text in NEUTRAL_TEMPLATES.items()
    }
