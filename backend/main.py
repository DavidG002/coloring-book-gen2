import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import init_db
from routers import categories, translations, settings, generation, prompt_defaults, publish, language_templates, review, books, account_settings, wordpress, seo, backup, auth
from services.backup import maybe_run_auto_backup
from database import SessionLocal

app = FastAPI(title="Coloring Book Generator API")

# Configurable via CORS_ALLOWED_ORIGINS (comma-separated) so production
# (frontend and backend on separate subdomains, e.g. yooprints.com /
# api.yooprints.com — see the VPS deploy roadmap) doesn't need another
# code change to add its real origin. Defaults to local dev's origin,
# unchanged from before this was made configurable.
_cors_origins_env = os.environ.get("CORS_ALLOWED_ORIGINS")
allow_origins = (
    [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    if _cors_origins_env
    else ["http://localhost:3000"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()  # ensures tables exist on startup — harmless no-op if they already do

app.include_router(categories.router)
app.include_router(translations.router)
app.include_router(settings.router)
app.include_router(generation.router)
app.include_router(prompt_defaults.router)
app.include_router(publish.router)
app.include_router(language_templates.router)
app.include_router(review.router)
app.include_router(books.router)
app.include_router(account_settings.router)
app.include_router(wordpress.router)
app.include_router(seo.router)
app.include_router(backup.router)
app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.on_event("startup")
def startup_backup_check():
    db = SessionLocal()
    try:
        maybe_run_auto_backup(db)
    finally:
        db.close()