# Generation & Publishing Pipeline

## The flow, in order

Book (base_prompt, product_noun, canvas/cleanup settings)
→ Category (Subjects × Variations)
→ Generate (real image, cost ~$0.007/image, gpt-image-2 "low" quality)
→ Review (approve or reject — reject quarantines to _rejected/, never deletes)
→ local Publish (the approval gate — see below)
→ WordPress push (optional, requires local Publish first)


## Generation

`build_task_list` (`services/generation.py`) expands a category's
Subjects × requested-variations-per-subject into concrete generation
tasks, cycling through the category's Variation list in order (wrapping
around if more images are requested than variations exist — see the
caveat in `seo-pipeline.md` about what this means for SEO content reuse).

Each task's prompt is `book.base_prompt + f" Cute {subject}. {variation_text}."`
— note the literal word "Cute" is still hardcoded here from the original
kids'-coloring-book-only version of this script; it has not caused
visible problems since Book prompts generally describe their own style
regardless, but is worth knowing about if a Book's tone is meant to be
distinctly *not* cute (e.g. the adult/botanical or a hypothetical
serious/technical Book).

`generate_image_file` calls the OpenAI image API, then runs a fixed
Pillow post-processing pipeline (`_process_raw_image`): thumbnail to the
Book's `subject_size_ratio`, paste centered onto a canvas of the Book's
configured size, apply black/white cleanup thresholds, reduce to the
Book's configured palette size. This same pipeline is reused by the
**Settings Preview** feature (see below), so a preview and a real
generation are pixel-for-pixel produced the same way.

## Settings Preview

Before running a real batch, a Book's settings page offers a "Preview
settings" action: generates **one real image** (same cost as any other,
~$0.007) using a real subject/variation already defined somewhere in the
Book's categories, and displays it with pan/zoom (`true size` vs. `fit to
screen` view). This exists specifically so prompt/settings tuning doesn't
require committing to a full batch to see the result — genuinely useful
given how much iteration image-generation prompts typically need.

Requires at least one category with a subject and a variation to exist
first — there is no synthetic/placeholder subject fallback, by design
(an earlier version used a generic "sample test subject" sentence; this
was deliberately replaced with real subject/variation data so the preview
matches genuine output exactly, not an approximation).

Every settings preview is saved to `BookPreview` history (with its own
disk folder, `preview_cache/{book_id}/`) — nothing paid for is discarded.

## Review

`GenerationImage.status` is `"approved"` or `"rejected"`. Rejecting moves
the file to `output/{category}/_rejected/` (never deleted) and is
reversible (`restore_image`). Local Publish's file-globbing only looks in
`output/{category}/` directly, so rejected images are automatically
excluded from anything downstream — no separate filtering logic needed.

## Local Publish — the approval gate

`build_publish_plan` computes, for a given category+language, every
eligible file with its translated/SEO metadata, tagged `is_new` (not yet
in any prior `PublishRun` for this category+language) vs. already
published. `execute_publish` copies files into
`publish/{lang}/{category}/`, writes `manifest.csv`, and records a
`PublishRun`/`PublishedFile` history entry.

This step exists as a genuine gate, not just a file-copy convenience: **an
image cannot be pushed to WordPress until it has appeared in at least one
local Publish run** (`get_locally_published_paths` in
`services/wordpress_publish.py`). The reasoning: local Publish is where a
human has actually looked at the translated/SEO content and files before
they become "real" — skipping straight from raw generation to a live
WordPress post would remove that checkpoint entirely.

`manifest.csv` is not just an artifact of the automated pipeline — it's a
first-class alternative path, deliberately kept fully-featured (same real
SEO content as the WordPress push, not placeholder text) so that manual
upload or WP All Import remains a genuinely viable option for anyone
without (or choosing not to use) the direct WordPress integration. See
the README's cost/feature-tier framing for why this matters at all: not
every user will want or be able to pay for a Polylang Pro-style
automation stack, and the manual path should not be a second-class
citizen.

## Cost summary

- Image generation: ~$0.007/image (`gpt-image-2`, "low" quality)
- Settings preview: same, ~$0.007 per preview (it's a real generation)
- Translation (`translate_phrases`) and SEO content generation: `gpt-4o-mini`,
  a small fraction of a cent per call, cached per unique combination —
  does not scale with image count (see `seo-pipeline.md`)
