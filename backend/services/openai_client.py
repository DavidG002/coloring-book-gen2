from openai import OpenAI
from database import SessionLocal
from models import AppCredential
from services.crypto import decrypt_secret


def resolve_credential(user_id: int | None) -> tuple[OpenAI, str]:
    """Resolves which OpenAI credential to use for a given user, and
    returns both the ready-to-use client AND the credential key that
    identifies which row was actually used (for rate-limiting — see
    services/rate_limits.py). Resolving both together, from the same
    query, matters: resolving them separately risked the rate limiter
    keying off a different row than the one the client actually used, if
    a key was added/removed in between the two lookups.

    Falls back to the shared "house" key (AppCredential id=1) whenever
    the user has no personal key of their own, or when user_id is None
    (a caller with no user context, e.g. a very old background task) —
    this fallback is deliberate (roadmap task 5's confirmed design), not
    a bug: most users are expected to run on the house key indefinitely,
    with a personal key being the exception, not the default.
    """
    db = SessionLocal()
    try:
        row = None
        if user_id is not None:
            row = db.query(AppCredential).filter(AppCredential.user_id == user_id).first()

        if row and row.openai_api_key:
            credential_key = f"user:{user_id}"
        else:
            row = db.query(AppCredential).filter(AppCredential.id == 1).first()
            credential_key = "house"

        encrypted_key = row.openai_api_key if row else None
    finally:
        db.close()

    if not encrypted_key:
        raise ValueError("No OpenAI API key configured. Add one in Settings.")

    api_key = decrypt_secret(encrypted_key)
    return OpenAI(api_key=api_key), credential_key
