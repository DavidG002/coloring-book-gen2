# Data Model

## The core hierarchy

Book
└─ Category (many)
├─ Subject (many)
├─ Variation (many)
└─ Translation (one per language)
├─ TranslationItem (one per Subject)
└─ VariationTranslationItem (one per Variation)


A **Book** is the top-level container: it owns a shared image-generation
prompt (`base_prompt`), a `product_noun` (e.g. "coloring page", "stencil"
— used to keep AI-generated copy on-topic regardless of what the Book
actually is), and canvas/cleanup image settings (size, thresholds,
palette). Every Category inside a Book inherits these.

A **Category** groups a set of Subjects (e.g. "Car", "Rose") with a set
of Variations (pose/angle descriptors, e.g. "side view on a road"). Every
Subject × Variation combination is a potential generated image.

## Generation records

GenerationJob (one batch run)
└─ GenerationImage (one per file, includes variation_text used, wp_excluded flag)


`GenerationImage.variation_text` is the actual text used for that specific
file — this is what SEO content generation keys off, not just the
subject/variation numbering. Images generated before this field existed
have it as `NULL` and cannot be pushed to WordPress (a deliberate hard
stop — see `wordpress-integration.md`).

## Translation vs. SEO — two different layers

**`Translation`** (+ its two item tables) is pure linguistic translation:
what is this category/subject/variation *called* in a given language.
Also holds the three name-templates (filename/alt/title patterns with
`{category}`/`{item}`/`{variant}` tokens) — these are the older, simpler
mechanism, mostly superseded by SEO content below for anything pushed to
WordPress, but still used as the manifest.csv fallback for legacy images.

**`ContentVariant`** is a separate, AI-generated layer: real natural-
language title/alt text/excerpt/body content, one row per
(Subject, Variation, language) — **not** per image. This is deliberate:
cost and generation calls scale with how many *distinct combinations*
exist, not how many images you generate. Cached indefinitely; editable
and regeneratable per field from the SEO panel.

**`CategoryDescription`** is the same idea at the category level — one
description per (category, language), used as the WordPress taxonomy
term's description.

Both `ContentVariant` and `CategoryDescription` generation prompts are
built from the owning Book's `base_prompt` + `product_noun`, so tone
stays correct regardless of what kind of product a Book represents (kids'
coloring pages vs. adult line art vs. stencils, etc.) — nothing is
hardcoded to assume "children's coloring book."

## Local Publish records

PublishRun (one per publish action)
└─ PublishedFile (one per file in that run)


Local Publish is the **approval gate**: only files that have gone through
at least one `PublishRun` for a given category+language are eligible to
push to WordPress (see `get_locally_published_paths` in
`services/wordpress_publish.py`). `PublishedFile` stores its own snapshot
of `alt_text`/`title_text`/`excerpt_text`/`content_text` at publish time —
these feed both the on-disk `manifest.csv` and the "download manifest"
button, with graceful fallback to the old template-based text for legacy
images missing `ContentVariant` data.

## WordPress tracking records

WordPressCategoryTerm — (category, lang, site_url) → wp_term_id
WordPressPublishedItem — (source_path, lang, site_url) → wp_post_id, wp_media_id
+ a content snapshot (pushed_title, pushed_alt_text,
pushed_excerpt, pushed_content) for drift detection


Both tables are scoped by `site_url` — this is critical and was added
after a real incident switching from a sandbox WordPress install to
production (see `wordpress-integration.md` for the full story). Without
site scoping, switching the configured WordPress site would cause the app
to think content was already published on a site it had never touched.

`WordPressCategoryTerm` exists to guarantee a taxonomy term (e.g.
"Vehicles") is created on WordPress **once** per (category, language,
site) and reused for every image pushed under it, never duplicated.

`WordPressPublishedItem`'s content snapshot is what powers the "Needs
update" / "Update on WordPress" feature: if you edit or regenerate an
image's `ContentVariant` after it's already been pushed, the current
content is compared against the snapshot on every preview load, and a
mismatch surfaces as a clear, actionable badge rather than silently
drifting out of sync.

## Account-level / global settings

AppCredential — single row, OpenAI API key
WordPressIntegration — single row, site URL/credentials/post_type/
taxonomy/use_polylang_linking toggle
SupportedLanguage — the managed list of language codes+names,
drives every language picker in the app
LanguageTemplateDefault — per (Book, language) saved template starting
point, used by "Auto-translate template structure"


`AppCredential` and `WordPressIntegration` are deliberately single-row
tables (`id=1` always) rather than proper multi-row tables — this is a
known, deliberate simplification for the current single-user design (see
`environment-deployment.md` for what a multi-user version would need to
change here).
