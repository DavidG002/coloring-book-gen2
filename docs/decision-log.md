# Decision Log / Known Debt

A running record of deliberate tradeoffs, things fixed after being wrong,
and work knowingly deferred. Keep this current — it is the single most
useful document for picking this project back up after time away.

## Deliberate tradeoffs (still correct as designed)

- **Local Publish gates WordPress push.** An image cannot be pushed to
  WordPress without first appearing in a local `PublishRun`. This is a
  safety/review checkpoint, not an oversight — see
  `generation-publishing.md`.
- **WordPress content is never deleted by this app**, under any
  circumstance, including Book/Category deletion. Always a manual,
  deliberate wp-admin action. See `wordpress-integration.md`.
- **SEO content generation is cached per (subject, variation, language),
  not per image** — cost and API calls scale with distinct combinations,
  not with batch size.
- **Polylang Pro linking is a toggle, off by default**, safe to enable
  before Pro is active (fields are silently ignored by plain WordPress).
  Treated as a genuine first-class feature to run *without* Polylang, not
  a temporary stand-in — some users will never have Polylang Pro.
- **`manifest.csv` is kept fully-featured**, not a stripped-down fallback
  — carries the same real SEO content as the automated WordPress push, so
  manual upload / WP All Import remains a genuinely complete alternative
  path for anyone not using (or not wanting to pay for) the direct
  integration.
- **Rejected images are quarantined (`_rejected/` folder), never
  deleted** — reversible via `restore_image`.
- **Book deletion offers an explicit choice**: remove app configuration
  only (files untouched) vs. permanently delete generated files too (the
  latter requires typing the Book's name to confirm). No silent
  destructive default.

## Bugs found and fixed — worth knowing the history

- **Site-scoping was originally missing entirely** from
  `WordPressPublishedItem`/`WordPressCategoryTerm`. Discovered while
  migrating from a sandbox WordPress install to production — the fix
  (adding `site_url`, filtering every lookup by it) also required
  rebuilding both tables' `UNIQUE` constraints, since SQLite cannot alter
  constraints via `ALTER TABLE ADD COLUMN` alone. See
  `wordpress-integration.md` for the full incident and recovery.
- **Hardcoded "children's coloring page" / "coloring page" assumptions**
  existed in three separate places at different times: the SEO content
  generation prompts, the `NEUTRAL_TEMPLATES` starting pattern for
  auto-translated templates, and the image-generation prompt's literal
  "Cute {subject}" (the last one is still present — see
  `generation-publishing.md`). Fixed for the first two by introducing
  `Book.product_noun` and threading it through every generation prompt;
  the Book's `base_prompt` was already meant to carry style/audience but
  wasn't being read by the SEO-generation functions until this fix.
- **`LANGUAGE_NAMES` dict was missing an `"en"` entry** for a long
  stretch, causing "Auto-translate template structure" for English to
  send a nonsensical "translate this into en" instruction to the LLM,
  producing garbled mixed-language output. Fixed by adding the entry;
  worth checking this dict whenever a new language behaves oddly.
- **Manual `.env` OpenAI key was stale-cached** — the original
  `services/generation.py`/`services/translate.py` built one `OpenAI()`
  client at import time from `.env`, so changing the key via Settings
  (once that UI existed) silently had no effect. Fixed via
  `services/openai_client.py`, which builds a fresh client from the
  database on every call.
- **Several `BookRead(...)` response constructions were built by hand**,
  field by field, in multiple router functions (`get_book`, `create_book`,
  `update_book`) rather than using Pydantic's `model_validate`. Adding a
  new field to `Book` (`product_noun`) required updating all three
  separately, and one was initially missed, causing the field to
  silently revert to its schema default after a page reload despite
  saving correctly. **Any future field added to a model with this
  pattern must be grepped for and added to every hand-built response
  construction, not just one.**
- **A stray placeholder value (`"string"`, Swagger's default example
  text) was accidentally saved as real WordPress settings** more than
  once during testing, because the settings save always sends the
  entire form state, including any field a user hadn't actually reviewed
  before clicking Save. No input validation currently prevents saving an
  obviously-invalid site URL. Worth adding a basic URL-shape check to the
  Settings save handler.

## Known, deliberately deferred work

- **Polylang backfill** — retroactively linking WordPress content that
  was pushed *before* `use_polylang_linking` was turned on. Design is
  clear (same `translations[lang]=id` mechanism, applied to existing
  post/term IDs already in our tracking tables), not yet built.
- **"Verify against WordPress" / self-healing sync** — if a post is
  deleted directly in wp-admin (not through this app), our tracking
  tables have no way to detect that and will continue treating it as
  live. A bulk `GET` check against WordPress with local cleanup on 404
  responses would close this gap. Not built; flagged as a real, likely-
  to-recur scenario, not just a hypothetical.
- **No frontend↔backend schema generation** — the typed API client
  (`frontend/lib/api/`) is hand-maintained to match backend Pydantic
  schemas. This has caused repeated bugs when a backend field was added
  without the matching frontend TypeScript interface being updated (the
  compiler catches it, but only after the fact). An OpenAPI-to-TypeScript
  codegen step would eliminate this whole class of bug; not currently
  set up.
- **No per-image bulk delete from the UI** — deletion is scoped to a
  whole Category or Book; individual generated images can only be
  removed via Review's reject (quarantine) or by manual file deletion.
- **`batch_confirmation_threshold` setting exists but is not enforced**
  anywhere in the UI — it's stored and editable in Settings but no code
  currently reads it to trigger an actual confirmation prompt.

## Known, deferred security items

- **Next.js/PostCSS/sharp dependency vulnerabilities** — `npm audit`
  flags several high-severity issues in the Next.js dependency chain,
  fixable only via `npm audit fix --force`, which would push Next.js to
  16.3.1 (outside the current stated range). Deferred: this app runs
  locally, not on a publicly exposed server, so real-world exploitability
  is low right now. Revisit as a dedicated task (with a full app
  re-test) before any real deployment to a public-facing environment.
