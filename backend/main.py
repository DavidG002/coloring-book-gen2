from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import init_db
from routers import categories, translations, settings, generation, prompt_defaults, publish, language_templates, review, books, account_settings, wordpress

app = FastAPI(title="Coloring Book Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


@app.get("/health")
def health():
    return {"status": "ok"}