"""Resolves a Book's structured style knobs into concrete prompt phrases.
This is the one place these mappings live — both real generation and
Settings Preview must go through here, so a knob always means the same
thing regardless of where the prompt gets built."""

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


def resolve_knob_phrases(line_weight: str, detail_density: str, style_tone: str) -> str:
    """Turns three knob values into a single phrase clause, appended to the
    base prompt. Falls back gracefully to the 'medium' default option if an
    unrecognized value somehow gets stored (e.g. from a future removed
    option), rather than raising an error mid-generation."""
    parts = [
        LINE_WEIGHT_OPTIONS.get(line_weight, LINE_WEIGHT_OPTIONS["medium"]),
        DETAIL_DENSITY_OPTIONS.get(detail_density, DETAIL_DENSITY_OPTIONS["moderate"]),
        STYLE_TONE_OPTIONS.get(style_tone, STYLE_TONE_OPTIONS["balanced"]),
    ]
    return ", ".join(parts) + "."


def build_full_prompt(base_prompt: str, subject: str, variation_text: str, line_weight: str, detail_density: str, style_tone: str) -> str:
    """The single, shared function for constructing a final image-generation
    prompt from a Book's base_prompt + knobs + subject/variation. Both real
    generation and Settings Preview must call this, not build the string
    themselves — this is what keeps prompt_used honest and keeps knobs from
    silently drifting between the two paths."""
    knob_phrase = resolve_knob_phrases(line_weight, detail_density, style_tone)
    return f"{base_prompt} {knob_phrase} Cute {subject}. {variation_text}."
