# WordPress Integration

## The publishing gate

An image is only eligible to push to WordPress if it has gone through
**local Publish** at least once for that category+language
(`get_locally_published_paths` in `services/wordpress_publish.py`). This
is deliberate: local Publish is where review/approval happens, and
skipping straight to WordPress from raw generation would let unreviewed
or untranslated content go live.

## REST endpoint naming — a real gotcha

WordPress's REST API uses **plural** route names for built-in post
types/taxonomies, but the underlying `post_type`/`taxonomy` slugs stored
in our settings are **singular** (`post`, `category`, matching what a
site owner would recognize). This mapping is handled explicitly:

```python
TAXONOMY_REST_BASE = {"category": "categories", "post_tag": "tags"}
POST_TYPE_REST_BASE = {"post": "posts", "page": "pages"}
```

A custom post type or taxonomy typically uses its own slug as-is for the
REST base (no pluralization), so the `.get(x, x)` fallback pattern
handles that case correctly without special-casing.

## Site-scoping — why every tracking row has a `site_url`

**Real incident, worth remembering:** when moving from a sandbox
WordPress install to the real production domain, the app initially had
no concept of "which site" a push belonged to — `WordPressPublishedItem`
and `WordPressCategoryTerm` were keyed only on
(category/source_path, language). Switching the configured site URL in
Settings would have made the app believe production content was already
published, when it had only ever touched the sandbox.

The fix: both tables carry a `site_url` column, and every lookup
(`get_already_pushed_paths`, `get_sibling_translations`,
`ensure_category_term`, the drift-detection query in
`preview_wordpress_push`) filters by the **currently configured**
`config.site_url`. Switching sites in Settings now correctly makes all
prior content invisible to "already pushed" checks — a genuine new site
push starts clean, automatically, no manual database work needed.

**Caveat discovered in practice:** if you point the app at a *different
domain that is actually the same underlying WordPress install* (e.g. a
domain got repointed rather than a genuinely fresh site), old
`WordPressCategoryTerm` rows will still show as "not found" for the new
URL — but the *actual term* may still exist on WordPress under the old
ID. Pushing in that situation can hit a `term_exists` (400) error from
WordPress even though our side thinks it's new. If this happens, manually
record the existing term ID under the new `site_url` rather than letting
the app try to recreate it — see git history around the production
migration for the exact recovery script used.

**Migration note:** the original `UNIQUE` constraints on both tracking
tables did not include `site_url` and had to be rebuilt (SQLite can't
alter constraints via `ALTER TABLE`, only add columns) — a pure "add
column" migration alone is insufficient if you're duplicating this
pattern elsewhere; the constraint itself needs recreating via a
rename-create-copy-drop sequence.

## Media alt text / title — two-step upload

`upload_media` uploads the file first (`POST /wp/v2/media`, no alt
text/title accepted in that call), then makes a **second** call
(`POST /wp/v2/media/{id}`) to set `alt_text`/`title`. This is a REST API
limitation, not a choice — the initial upload endpoint doesn't accept
those fields directly.

## Content variants, not templates, drive what actually gets pushed

`push_batch_to_wordpress` calls `ensure_content_variant` per image (see
`seo-pipeline.md`) and uses its `seo_title`/`seo_alt_text`/`seo_content`/
`seo_excerpt` for the post — **not** the older template-based
`title_text`/`alt_text` from `build_publish_plan`. An image missing
`GenerationImage.variation_text` (i.e. generated before that tracking
existed) will hard-fail the push with a clear error rather than silently
falling back to lower-quality template text — unlike local Publish, which
does fall back gracefully for the same case (different tolerance,
deliberate: WordPress push should never silently ship worse content).

## Drift detection & sync

`WordPressPublishedItem` stores a snapshot (`pushed_title`,
`pushed_alt_text`, `pushed_excerpt`, `pushed_content`) at push/sync time.
`preview_wordpress_push` compares the *current* `ContentVariant` against
that snapshot on every load; a mismatch sets `needs_update: true` on that
row. `POST /wordpress/sync` re-sends current content to the already-
existing WordPress post/media (via `update_post`/`update_media_alt_text`)
and refreshes the snapshot. The frontend surfaces this as a coral "Needs
update" badge + sync button, only shown when there's genuine drift.

## Polylang Pro linking

Controlled by `WordPressIntegration.use_polylang_linking` (off by
default). When on, `create_post` and `ensure_category_term` include
`lang`/`translations` fields, using sibling lookups
(`get_sibling_translations`, `get_sibling_term_translations`) against
`WordPressPublishedItem`/`WordPressCategoryTerm` for the same site.

**Safe to enable before Polylang Pro is actually active** — WordPress's
REST API silently ignores unrecognized fields, confirmed by testing
against the sandbox pre-Pro. Real linking only takes effect once Polylang
Pro is installed, active, and its settings
(`GET /wp-json/pll/v1/settings`) have the relevant `post_types`/
`taxonomies` enabled for translation.

**Not yet built:** a backfill operation to retroactively link content
that was pushed *before* the toggle was turned on. The bookkeeping data
needed for this already exists (`WordPressPublishedItem` has every post
ID per language); the linking calls themselves would be the same
`translations[lang]=id` pattern already used for new pushes.

## Elementor sites — featured image may not render

**Real incident:** on the production site (Elementor-based theme), pushed
posts had no visible featured image on the front end despite the image
being correctly uploaded and attached (`featured_media` correctly set,
confirmed in wp-admin and the Media Library). Root cause: Elementor's
"Single Post" template (Theme Builder) was empty — nothing on the page
was configured to display the featured image at all.

This is **not fixable from our side** — it's a WordPress/Elementor
template configuration issue. Fix: in Elementor's Theme Builder, the
Single Post template needs, at minimum, a Featured Image widget, a Post
Title widget, and a Post Content widget, published with "Entire Site" (or
scoped to the relevant post type) as its display condition. Worth
checking for on any new Elementor-based WordPress site before assuming a
push "isn't working" when it may just be a template gap.

## Deletion never touches WordPress

Deleting a Book or Category in the app never deletes anything on
WordPress, under any circumstance — this is a deliberate, hard rule (see
`services/book_deletion.py`). WordPress content removal is always a
manual, deliberate action in wp-admin. Local bookkeeping rows
(`WordPressPublishedItem`, `WordPressCategoryTerm`) *are* cleared on
delete, since they become meaningless once the local category is gone —
but the actual posts/media/terms on the live site are left untouched.
