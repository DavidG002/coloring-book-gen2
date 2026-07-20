# Coloring Book Generator

A full-stack tool for generating, translating, and publishing print-ready
coloring book pages using OpenAI's image generation API. Built as a web app
(Next.js frontend + FastAPI backend) replacing an earlier CLI-script version.

## Features

- **Categories** — define subjects (e.g. "Car", "T-Rex") and pose/angle
  variations per category, each with its own base image-generation prompt
- **Generation** — preview a batch's cost before spending anything, run it
  asynchronously with live progress, cancel mid-batch
- **Settings** — canvas size (with paper-size presets), image cleanup
  thresholds, generation pacing — all editable, no code changes needed
- **Translations** — per-subject and per-variation translations for any
  language, with one-click auto-translation via a cheap LLM call
- **Publish** — turns generated images into a renamed, SEO-ready, translated
  copy with a WordPress-import-ready `manifest.csv`, tracks what's already
  been published vs. new, keeps a full history per category/language

## Project structure

coloring-book-gen2/
├── backend/ FastAPI app
│ ├── main.py
│ ├── models.py SQLAlchemy models
│ ├── schemas.py Pydantic request/response schemas
│ ├── database.py DB session setup
│ ├── routers/ One file per resource (categories, generation, etc.)
│ ├── services/ Core logic (generation, publish, translate)
│ ├── output/ Generated working images (gitignored)
│ ├── publish/ Published, renamed copies + manifests (gitignored)
│ └── data.db SQLite database (gitignored)
└── frontend/ Next.js app (App Router)
├── app/ Pages
├── components/ Shared UI (GeneratePanel, TranslationsPanel, etc.)
└── lib/api/ Typed API client


## Prerequisites

- Python 3.10+
- Node.js 18.18+
- An OpenAI API key with access to `gpt-image-2` (image generation) and a
  chat model (used for auto-translation)

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
```

Initialize the database (first time only):

```bash
python3 -c "from models import init_db; init_db()"
```

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

## Cost notes

Image generation uses `gpt-image-2` at the "low" quality tier — roughly
$0.007 per image. The generate panel shows a cost estimate before you
confirm any batch. Auto-translation uses `gpt-4o-mini` and costs a small
fraction of a cent per category/language (translations are per unique
variation phrase, not per generated image, so cost doesn't scale with
batch size).

## Known limitations / not yet built

- No WordPress API integration yet — publish produces local files +
  manifest.csv, upload is still manual
- No batch-scoped publish (e.g. "only publish what I generated today") —
  publish always considers everything in `output/` for a category
- Single-job generation only — one batch runs at a time
- No authentication — intended for local/single-user use

## License

MIT
