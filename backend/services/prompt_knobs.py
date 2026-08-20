"""Resolves a Book's structured style knobs into concrete prompt phrases.
This is the one place these mappings live — both real generation and
Settings Preview must go through here, so a knob always means the same
thing regardless of where the prompt gets built.

Each knob has a curated set of preset options. If a Book's stored value
for a knob isn't a recognized preset key, it's treated as raw custom
text and used directly — this is what lets a user type something like
"grumpy" for character_mood without that option existing in the preset
list. No separate "is_custom" flag needed; unrecognized value = custom.

Every knob can also be individually disabled per-Book (its _enabled
flag) — a disabled knob contributes nothing to the prompt at all, for
product types (emojis, icons, etc.) where a given axis doesn't apply."""

KNOB_NAMES = [
    "line_weight",
    "detail_density",
    "style_tone",
    "subject_treatment",
    "character_mood",
    "background_richness",
    "border_style",
]

LINE_WEIGHT_OPTIONS = {
    "thin": "delicate thin outlines",
    "medium": "clean medium-weight lines",
    "bold": "thick bold confident outlines",
}

DETAIL_DENSITY_OPTIONS = {
    "minimal": "very simple shapes, minimal detail",
    "moderate": "moderate detail, balanced complexity",
    "intricate": "intricate detail, complex layered patterns",
}

STYLE_TONE_OPTIONS = {
    "playful": "playful, friendly cartoon style",
    "balanced": "clean, approachable style, not overly childish or overly realistic",
    "elegant": "elegant, refined, sophisticated style",
}

SUBJECT_TREATMENT_OPTIONS = {
    "personified": "expressive character with personality, face and emotion where appropriate",
    "realistic": "naturalistic, accurate representation, no anthropomorphism, no facial features unless anatomically real",
    "neutral": "plain, straightforward representation of the subject",
}

CHARACTER_MOOD_OPTIONS = {
    "cute": "cute, adorable, endearing expression",
    "aggressive": "fierce, bold, aggressive expression",
    "calm": "calm, gentle, serene expression",
    "mysterious": "mysterious, intriguing, enigmatic expression",
    "happy": "happy, joyful, upbeat expression",
    "silly": "silly, goofy, playful expression",
}

BACKGROUND_RICHNESS_OPTIONS = {
    "bare": "no background, clean white space around the subject",
    "light_props": "minimal background context, one or two simple supporting elements",
    "full_scene": "rich background scene with supporting elements and environmental detail",
}

BORDER_STYLE_OPTIONS = {
    "none": "",
    "simple_frame": "a simple thin border frame around the entire page",
    "decorative": "a decorative ornamental border frame around the entire page",
}

KNOB_OPTIONS = {
    "line_weight": LINE_WEIGHT_OPTIONS,
    "detail_density": DETAIL_DENSITY_OPTIONS,
    "style_tone": STYLE_TONE_OPTIONS,
    "subject_treatment": SUBJECT_TREATMENT_OPTIONS,
    "character_mood": CHARACTER_MOOD_OPTIONS,
    "background_richness": BACKGROUND_RICHNESS_OPTIONS,
    "border_style": BORDER_STYLE_OPTIONS,
}

DEFAULT_KNOB_VALUES = {
    "line_weight": "medium",
    "detail_density": "moderate",
    "style_tone": "balanced",
    "subject_treatment": "personified",
    "character_mood": "cute",
    "background_richness": "light_props",
    "border_style": "none",
}


def get_book_knobs(book) -> dict:
    """Extracts all seven knobs' value+enabled state from a Book model
    instance into a plain dict — the shared shape used everywhere else in
    this module, so callers never need to know about individual Book
    columns directly."""
    return {
        name: {
            "value": getattr(book, name, DEFAULT_KNOB_VALUES[name]),
            "enabled": getattr(book, f"{name}_enabled", True),
        }
        for name in KNOB_NAMES
    }


def resolve_knob_phrases(knobs: dict) -> str:
    """Turns a knobs dict into a single phrase clause appended to the base
    prompt. Skips any disabled knob entirely. character_mood is further
    skipped unless subject_treatment is both enabled and set to
    'personified' — mood only makes sense when there's a character to
    have one."""
    treatment = knobs.get("subject_treatment", {})
    treatment_active = treatment.get("enabled", True) and treatment.get("value") == "personified"

    parts = []
    for name in KNOB_NAMES:
        entry = knobs.get(name, {})
        if not entry.get("enabled", True):
            continue
        if name == "character_mood" and not treatment_active:
            continue

        value = entry.get("value", "")
        if not value:
            continue

        options = KNOB_OPTIONS[name]
        phrase = options.get(value, value)  # unrecognized value = custom text, used as-is
        if phrase:
            parts.append(phrase)

    return (", ".join(parts) + ".") if parts else ""


def build_full_prompt(base_prompt: str, subject: str, variation_text: str, knobs: dict) -> str:
    """The single, shared function for constructing a final image-generation
    prompt from a Book's base_prompt + knobs + subject/variation. Both real
    generation and Settings Preview must call this, not build the string
    themselves. Note: subject_treatment + character_mood together fully
    replace what used to be a hardcoded 'Cute' — a Book can now genuinely
    be Realistic, Neutral, or any custom mood, not just forced-cute."""
    knob_phrase = resolve_knob_phrases(knobs)
    if knob_phrase:
        return f"{base_prompt} {knob_phrase} {subject}. {variation_text}."
    return f"{base_prompt} {subject}. {variation_text}."
