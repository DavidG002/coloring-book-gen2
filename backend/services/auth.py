"""Password hashing/verification and session-token verification.

Password hashing (bcrypt) happens only here — this is the single place
that knows how to check a user's password, whether the caller is the
/auth/verify-credentials endpoint (used by Auth.js's credentials provider
in the Next.js frontend) or the create_user.py CLI script used to add new
accounts. Raw passwords are never stored or logged anywhere.

Session tokens: Auth.js issues a signed JWT after a successful login,
using AUTH_SECRET as its HS256 signing key (the frontend is configured
with a custom jwt.encode/decode so the cookie is a plain signed JWT
rather than Auth.js's default encrypted-JWE format — see the frontend's
auth config). FastAPI never issues that token, it only verifies it here,
using the same secret from its own .env — so both sides agree on who's
signed in without a shared, database-backed sessions table.
"""

import os
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User

AUTH_SECRET = os.environ.get("AUTH_SECRET")
JWT_ALGORITHM = "HS256"


def hash_password(raw_password: str) -> str:
    return bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(raw_password.encode("utf-8"), password_hash.encode("utf-8"))


def decode_session_token(token: str) -> dict:
    """Decodes and verifies the JWT Auth.js issues. Raises jwt.PyJWTError
    (or a subclass) on anything invalid/expired/mis-signed — callers
    should catch that and turn it into a 401 rather than a 500."""
    if not AUTH_SECRET:
        raise RuntimeError(
            "AUTH_SECRET is not set. Add it to backend/.env — it must be "
            "the exact same value as AUTH_SECRET in frontend/.env.local, "
            "since it's how the two sides agree a session token is valid."
        )
    return jwt.decode(token, AUTH_SECRET, algorithms=[JWT_ALGORITHM])


def get_current_user(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency — add `user: User = Depends(get_current_user)`
    to any route that needs to know who's calling. Expects the frontend
    to send `Authorization: Bearer <session token>` on every API request
    once signed in.

    Also accepts the same token as a `?token=` query parameter, as a
    fallback for the handful of routes hit directly by <img src> (preview
    and review image files) — a browser-native image request can't attach
    a custom header, so those URLs carry the token in the query string
    instead. Prefer the header wherever the caller controls the request
    (every plain fetch call does); the query param exists only for that
    <img>-tag case."""
    bearer_token = None
    if authorization and authorization.startswith("Bearer "):
        bearer_token = authorization.removeprefix("Bearer ").strip()
    elif token:
        bearer_token = token

    if not bearer_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_session_token(bearer_token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid session token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Stricter version of get_current_user for actions that affect
    everyone's data at once (whole-database backup/restore, say) — not
    just the caller's own. Chains off get_current_user, so it also
    covers "not logged in at all"."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
