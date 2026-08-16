# Coloring Book Generator

A full-stack tool for generating, translating, and publishing print-ready
coloring book pages (or similar line-art products — stencils, icons, etc.)
using OpenAI's image generation API, with direct WordPress publishing.
Built as a web app (Next.js frontend + FastAPI backend).

## Features

- **Books** — the top-level container. Each Book has its own base image
  prompt, product type (e.g. "coloring page", "stencil"), canvas/cleanup
  settings, and holds one or more Categories. A settings preview lets you
  generate one real test image against a Book's current settings before
  running a full batch.
- **Categories** — belong to a Book. Define subjects (e.g. "Car", "Rose")
  and pose/angle variations, each reused across every subject in the
  category.
- **Generation** — preview a batch's cost before spending anything, run it
  asynchronously with live progress, cancel mid-batch. A Review step lets
  you reject bad results (quarantined, not deleted) before anything is
  published.
- **Translations** — per-subject, per-variation, and per-category-name
  translations for any language, with one-click auto-translation via a
  cheap LLM call. Supported languages are managed centrally in Settings.
- **SEO** — a separate, AI-generated layer on top of translations: a real
  natural-language title, alt text, excerpt, and body content per
  subject+variation+language (not template concatenation), plus a category
  description used as the WordPress taxonomy term's description. Fully
  editable and regeneratable per field, per row.
- **Local Publish** — copies generated images into a translated, SEO-ready,
  renamed set of files with a `manifest.csv` (for manual upload or
  WP All Import), tracks what's already published vs. new, keeps full
  history. This is the approval gate — only images that have gone through
  local Publish are eligible to push to WordPress.
- **WordPress integration** — pushes locally-published images directly to
  a WordPress site via the REST API: uploads media, creates the post with
  real SEO content, reuses (never duplicates) the category's taxonomy term.
  Batches are grouped by local publish run, individual images can be
  excluded from publishing, and already-pushed content can be re-synced
  in one click if you edit its SEO content afterward (drift is detected
  automatically). Supports draft or live publish status.
- **Polylang Pro linking** (optional, toggle in Settings) — once active on
  the target WordPress site, links posts and taxonomy terms across
  languages via Polylang's REST fields. Safe to leave off; without it,
  each language's content is still fully published, just not linked as
  translations of each other in WordPress's admin.
- **Account settings** — OpenAI API key, WordPress site credentials
  (Application Password), supported languages list, and generation pacing
  are all editable from the UI, no code or `.env` changes needed after
  initial setup.
- **Deletion** — Books and Categories can be deleted with a clear choice
  between "remove from app only" (keeps generated files on disk) and
  "delete everything including files" (irreversible, requires typing the
  name to confirm). WordPress content is never deleted automatically —
  that's always a deliberate, manual action in wp-admin.
- **Dark mode** — toggle in the top corner of every page, remembers your
  choice.

## Project structure

coloring-book-gen2/
├── backend/ FastAPI app
│ ├── main.py
│ ├── models.py SQLAlchemy models
│ ├── schemas.py Pydantic request/response schemas
│ ├── database.py DB session setup
│ ├── routers/ One file per resource
│ │ ├── books.py
│ │ ├── categories.py
│ │ ├── translations.py
│ │ ├── language_templates.py
│ │ ├── seo.py
│ │ ├── generation.py
│ │ ├── review.py
│ │ ├── publish.py
│ │ ├── wordpress.py
│ │ ├── account_settings.py
│ │ └── settings.py operational settings only (pacing)
│ ├── services/ Core logic
│ │ ├── generation.py
│ │ ├── publish.py
│ │ ├── translate.py
│ │ ├── content_variants.py SEO content generation
│ │ ├── wordpress_publish.py WordPress REST integration
│ │ ├── book_deletion.py
│ │ ├── wordpress.py connection test
│ │ └── openai_client.py builds a fresh client from the DB-stored key
│ ├── output/ Generated working images (gitignored)
│ ├── publish/ Published, renamed copies + manifests (gitignored)
│ ├── preview_cache/ Settings-preview test images (gitignored)
│ └── data.db SQLite database (gitignored)
└── frontend/ Next.js app (App Router)
├── app/
│ ├── page.tsx Dashboard
│ ├── books/ Books list, new, [id] detail + settings
│ ├── categories/[name]/ Category detail (Setup / Language / Generate / Publish, tabbed)
│ └── settings/ Account, AI provider, WordPress, Languages
├── components/ Shared UI (panels, modals, TabbedSection, etc.)
└── lib/api/ Typed API client

## Data model, briefly

`Book` → `Category` (many) → `Subject` + `Variation` (many-to-many via
generated images) → `Translation` (per language) → `ContentVariant` /
`CategoryDescription` (SEO content, per subject+variation+language,
cached and reusable). Generation produces `GenerationJob` /
`GenerationImage` records and real files in `output/`. Local Publish
produces `PublishRun` / `PublishedFile` records and files in `publish/`.
WordPress push produces `WordPressPublishedItem` (per image+language,
tracks the live post/media IDs and a content snapshot for drift
detection) and `WordPressCategoryTerm` (per category+language, tracks the
reused taxonomy term).

## Prerequisites

- Python 3.10+
- Node.js 18.18+
- An OpenAI API key with access to `gpt-image-2` (image generation) and a
  chat model (used for translation and SEO content generation)
- Optional, for WordPress publishing: a WordPress site with an
  [Application Password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)
  generated for your user

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Initialize the database (first time only):

```bash
python3 -c "from models import init_db; init_db()"
```

No `.env` file is required for normal operation — the OpenAI API key and
WordPress credentials are entered and stored through the app's Settings
page after you first run it (see below). This means they can be changed
at any time without restarting the server.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Running the app

Two servers run side by side during development — open two terminals.

**Terminal 1 — backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000`. The backend's interactive API docs are at
`http://localhost:8000/docs`.

### First-time setup, in order

1. Go to **Settings** (top-right of the dashboard) → **AI Provider** →
   enter your OpenAI API key.
2. Still in Settings → **Languages** → confirm the languages you'll need
   are listed (a starter set is seeded; add more with a code + name as
   needed).
3. If you'll be publishing to WordPress → Settings → **Integrations** →
   enter the site URL, username, and Application Password → **Test
   connection**. Also set **Post type** and **Taxonomy** (defaults to
   `post`/`category`, matching what most WordPress sites already have —
   no plugin or setup needed on the WordPress side for this to work).
4. Create a **Book** → set its name, product type, and base image prompt.
   Use the Book's **Settings → Preview settings** to test the prompt
   cheaply (one real image) before generating a full batch.
5. Add a **Category** to the Book → Subjects and Variations → Translations
   → SEO (optional, auto-generates on first Publish/push if skipped) →
   Generate → Review → Publish (local) → WordPress (optional).

## WordPress integration notes

- Publishing to WordPress requires an image to have gone through **local
  Publish first** — this is the deliberate approval gate, ensuring only
  reviewed, translated content with real metadata ever gets pushed.
- The taxonomy term for a category (e.g. "Vehicles") is created **once
  per category per language** and reused for every image under it —
  never duplicated.
- SEO content (title, alt text, excerpt, body content) is generated once
  per unique subject+variation+language combination and cached — cost
  scales with how many *distinct* combinations you use, not with how many
  images you generate.
- If you edit or regenerate an image's SEO content after it's already
  been pushed, the WordPress panel will flag it as **"Needs update"** —
  click **Update on WordPress** to sync the live post/media without
  creating a duplicate.
- **Polylang Pro linking** is off by default. Turning it on (Settings →
  Integrations) causes pushes to include Polylang's `lang`/`translations`
  fields, linking posts and terms across languages. This is safe to
  enable even before Polylang Pro is active — WordPress silently ignores
  unrecognized fields — but linking will only actually take effect once
  Polylang Pro is installed and active on the target site, and its
  Settings have the relevant post type/taxonomy enabled for translation
  (`GET /wp-json/pll/v1/settings` → check `post_types`/`taxonomies`).
- **Deleting** a Book or Category in this app never deletes anything on
  WordPress — that's always a manual step in wp-admin, by design.

## Cost notes

Image generation uses `gpt-image-2` at the "low" quality tier — roughly
$0.007 per image. The Generate panel shows a cost estimate before you
confirm any batch. Settings preview (one test image against current
Book settings) costs the same, ~$0.007 per preview. Translation and SEO
content generation use `gpt-4o-mini` and cost a small fraction of a cent
per call — both are cached per unique combination (translation: per
subject/variation/language; SEO: same, plus per category/language for
the description), so cost doesn't scale with how many images you
generate, only with how many genuinely new subject/variation/language
combinations you introduce.

## Known limitations / not yet built

- No authentication — intended for local/single-user use; a future
  multi-user version is planned as a separate project
- Single-job generation only — one batch runs at a time
- No bulk delete for individual generated images from the UI (deletion
  is per-Category or per-Book; use Review's reject for individual bad
  results before publishing)
- Polylang backfill (retroactively linking content that was pushed
  before Polylang Pro was active) is designed but not yet built
- No in-app user documentation yet (planned)

## License

MIT