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


def get_active_credential_key() -> str:
    """Identifies which OpenAI credential is "active", for rate-limiting
    purposes (see services/rate_limits.py). Today there's only ever one
    row (id=1, shared by every user — see get_openai_client above), so
    this always returns the same key and every user shares one rate-limit
    bucket. Once AppCredential moves to per-user (roadmap task 5), this
    becomes the caller's own credential id instead — rate limiting then
    becomes per-user automatically, with no change needed in
    services/rate_limits.py or any of its callers."""
    return "credential:1"