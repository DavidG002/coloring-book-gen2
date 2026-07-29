from openai import OpenAI
from database import SessionLocal
from models import AppCredential


def get_openai_client() -> OpenAI:
    """Builds a fresh OpenAI client using whatever key is currently saved
    in the database — so changes made via Settings take effect immediately,
    with no server restart needed."""
    db = SessionLocal()
    try:
        row = db.query(AppCredential).filter(AppCredential.id == 1).first()
        api_key = row.openai_api_key if row and row.openai_api_key else None
    finally:
        db.close()

    if not api_key:
        raise ValueError("No OpenAI API key configured. Add one in Settings.")

    return OpenAI(api_key=api_key)