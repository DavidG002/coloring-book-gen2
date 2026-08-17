# SEO Content Pipeline

## What this solves

Early on, WordPress post titles/alt text were built from simple string
templates (`{category} {item}`) — meaning every pose variation of the
same subject got **identical** title/alt text. At any real scale, this
creates near-duplicate content across dozens of posts, which is bad for
search ranking, not just cosmetically repetitive.

The fix: an AI-generated layer, genuinely distinct per subject+variation
combination, written as real sentences rather than concatenated
fragments.

## What gets generated

One LLM call (`generate_content_variant` in `services/content_variants.py`)
produces four fields together, in the target language:

- `seo_title` — a short, natural page title
- `seo_alt_text` — a natural, descriptive alt-text sentence
- `seo_excerpt` — one short sentence, used as WordPress's excerpt /
  meta-description fallback
- `seo_content` — one to two short, plain sentences for the post body

Generating all four in a single call is deliberate — cheaper than four
separate calls, and keeps the four fields contextually consistent (same
"voice") rather than independently generated and potentially mismatched.

A separate function, `generate_category_description`, produces one short
description per (category, language) for the WordPress taxonomy term.

## Tone comes from the Book, never hardcoded

Both generation functions receive the owning Book's `base_prompt` and
`product_noun` as context, and the prompt explicitly instructs the model
to use the correct product noun and match the described style/audience.
This was a real bug once: an earlier version hardcoded "children's
coloring page" into the prompt, which produced wrong-toned copy the
moment a Book was built for a different audience (discovered while
testing an adult-audience "Botanical Line Art" Book). Do not reintroduce
a hardcoded topic/audience assumption here — everything must flow from
the Book's own fields.

The prompt also explicitly avoids vague/overselling marketing language
("captures the essence," "invites viewers to appreciate," etc.) — added
after real generated copy for a niche subject (an unfamiliar real-world
object the image model didn't render accurately) confidently described
qualities the image didn't actually have. Keeping the copy plain and
concrete is a deliberate quality guard, not just a style preference.

## Caching — cost scales with combinations, not images

`ensure_content_variant` and `ensure_category_description` are pure
cache-or-generate functions: check for an existing row keyed on
(subject, variation, language) or (category, language); if present,
return it for free; if not, generate once and store.

This means generating 500 images from 4 subjects × 12 variations still
only costs at most 48 × (number of languages) LLM calls, not 500 — cost
is driven by how many genuinely new subject/variation/language
combinations you introduce, never by raw image count.

**Known caveat:** the variation-cycling logic in `build_publish_plan`
means if a subject has more generated images than defined variations, the
variation text wraps around and repeats — so two different image files
can share the same (subject, variation) row and therefore identical SEO
content. This is usually fine if variation lists are reasonably long
relative to how many images you generate per subject, but is not a hard
1:1 guarantee.

## Editing and regenerating

Every generated field is fully editable from the SEO panel (per-row
expand → edit → Save), and independently regeneratable
(`regenerate_content_variant`/`regenerate_category_description` force a
fresh LLM call even if a cached value exists — the fix for "the AI got
this one wrong," which does happen occasionally as normal LLM output
variance).

**Important:** editing/regenerating content for an image that has
*already been pushed to WordPress* does not automatically update the live
post — see the "Drift detection & sync" section in
`wordpress-integration.md`. The SEO panel and the WordPress panel are
deliberately separate concerns; syncing between them is an explicit,
visible action.

## Where this content actually gets used

- **WordPress push** (`push_batch_to_wordpress`) — always uses
  `ContentVariant`/`CategoryDescription`, hard-fails if unavailable
  (missing `variation_text` on the source image)
- **Local Publish** (`execute_publish`) — uses the same content when
  available, but falls back gracefully to the older template-based text
  for legacy images, since local Publish's manifest.csv is meant to
  always succeed, not gate on SEO data being present
