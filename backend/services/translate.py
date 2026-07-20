from openai import OpenAI

client = OpenAI()

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
