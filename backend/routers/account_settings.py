from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import AppCredential, WordPressIntegration, SupportedLanguage, User
from schemas import (
    OpenAIKeyRead, OpenAIKeyUpdate, UserSummary, OpenAIUserKeyRead, OpenAIKeyListResponse,
    WordPressIntegrationRead, WordPressIntegrationUpdate, WordPressTestResult,
    SupportedLanguageRead, SupportedLanguageCreate,
)
from services.wordpress import mask_key, test_wordpress_connection
from services.crypto import encrypt_secret, decrypt_secret
from services.auth import get_current_user, require_admin

router = APIRouter(prefix="/account", tags=["account"])

# NOTE: WordPressIntegration is still a singleton table shared by the whole
# app — per-site WordPress is a separate, not-yet-done follow-up to task 5
# (see the roadmap doc). OpenAI keys (AppCredential), below, ARE per-user as
# of task 5: id=1 is always the shared "house" key everyone falls back to;
# any other row is one user's personal key (user_id set). Only an admin can
# view or edit any key, house or personal — see require_admin below.


def _get_or_create_house_credential(db: Session) -> AppCredential:
    row = db.query(AppCredential).filter(AppCredential.id == 1).first()
    if not row:
        row = AppCredential(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _masked_read(row: AppCredential | None) -> tuple[bool, str | None]:
    """Decrypts just far enough to mask for display — never returns the
    real key to the frontend."""
    if not row or not row.openai_api_key:
        return False, None
    try:
        plaintext = decrypt_secret(row.openai_api_key)
    except ValueError:
        # A row that predates encryption, or was encrypted with a since-
        # rotated key — still "has a key" as far as the UI is concerned,
        # just can't be masked accurately. Surfacing this as "configured"
        # (rather than erroring the whole page) matches how a stale/bad
        # key already fails loudly the first time it's actually used.
        return True, "****"
    return True, mask_key(plaintext)


def _get_or_create_wp(db: Session) -> WordPressIntegration:
    row = db.query(WordPressIntegration).filter(WordPressIntegration.id == 1).first()
    if not row:
        row = WordPressIntegration(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/openai-key", response_model=OpenAIKeyRead)
def get_openai_key(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Kept for backward compatibility with older frontend builds — always
    reflects the shared HOUSE key specifically, regardless of who's asking
    or whether they have a personal key. Prefer GET /account/openai-keys
    (admin-only) for the full house + per-user picture."""
    row = _get_or_create_house_credential(db)
    has_key, masked = _masked_read(row)
    return OpenAIKeyRead(has_key=has_key, masked_key=masked)


@router.put("/openai-key", response_model=OpenAIKeyRead)
def update_openai_key(payload: OpenAIKeyUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    """Kept for backward compatibility — always updates the shared HOUSE
    key. Prefer PUT /account/openai-keys/house."""
    row = _get_or_create_house_credential(db)
    row.openai_api_key = encrypt_secret(payload.openai_api_key.strip())
    db.commit()
    has_key, masked = _masked_read(row)
    return OpenAIKeyRead(has_key=has_key, masked_key=masked)


# ---------- Admin-only: per-user OpenAI key management (task 5) ----------

@router.get("/users", response_model=list[UserSummary])
def list_users(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    """Every user account — used by the admin's OpenAI-key picker to assign
    a personal key to someone. Admin-only: this is account metadata, not
    something regular users need to browse."""
    users = db.query(User).order_by(User.name).all()
    return [UserSummary(id=u.id, email=u.email, name=u.name, is_admin=u.is_admin) for u in users]


@router.get("/openai-keys", response_model=OpenAIKeyListResponse)
def list_openai_keys(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    """The full picture: the shared house key, plus every user who has a
    personal key configured. Users with no personal key simply don't
    appear in personal_keys — they fall back to the house key automatically
    (see services/openai_client.resolve_credential)."""
    house_row = _get_or_create_house_credential(db)
    house_has_key, house_masked = _masked_read(house_row)

    personal_rows = (
        db.query(AppCredential)
        .filter(AppCredential.user_id.isnot(None))
        .all()
    )
    users_by_id = {u.id: u for u in db.query(User).all()}

    personal_keys = []
    for row in personal_rows:
        has_key, masked = _masked_read(row)
        owner = users_by_id.get(row.user_id)
        personal_keys.append(OpenAIUserKeyRead(
            user_id=row.user_id,
            user=UserSummary(id=owner.id, email=owner.email, name=owner.name, is_admin=owner.is_admin) if owner else None,
            has_key=has_key,
            masked_key=masked,
        ))

    return OpenAIKeyListResponse(
        house=OpenAIUserKeyRead(user_id=None, user=None, has_key=house_has_key, masked_key=house_masked),
        personal_keys=personal_keys,
    )


@router.put("/openai-keys/house", response_model=OpenAIUserKeyRead)
def update_house_openai_key(payload: OpenAIKeyUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = _get_or_create_house_credential(db)
    row.openai_api_key = encrypt_secret(payload.openai_api_key.strip())
    db.commit()
    has_key, masked = _masked_read(row)
    return OpenAIUserKeyRead(user_id=None, user=None, has_key=has_key, masked_key=masked)


@router.put("/openai-keys/user/{user_id}", response_model=OpenAIUserKeyRead)
def update_user_openai_key(user_id: int, payload: OpenAIKeyUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    row = db.query(AppCredential).filter(AppCredential.user_id == user_id).first()
    if not row:
        row = AppCredential(user_id=user_id)
        db.add(row)

    row.openai_api_key = encrypt_secret(payload.openai_api_key.strip())
    db.commit()
    db.refresh(row)
    has_key, masked = _masked_read(row)
    return OpenAIUserKeyRead(
        user_id=target.id,
        user=UserSummary(id=target.id, email=target.email, name=target.name, is_admin=target.is_admin),
        has_key=has_key,
        masked_key=masked,
    )


@router.delete("/openai-keys/user/{user_id}", status_code=204)
def delete_user_openai_key(user_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    """Removes a user's personal key — they immediately fall back to the
    house key on their next call, no other change needed."""
    row = db.query(AppCredential).filter(AppCredential.user_id == user_id).first()
    if row:
        db.delete(row)
        db.commit()


@router.get("/wordpress", response_model=WordPressIntegrationRead)
def get_wordpress_integration(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = _get_or_create_wp(db)
    return WordPressIntegrationRead(
        site_url=row.site_url,
        username=row.username,
        has_password=bool(row.app_password),
        post_type=row.post_type,
        taxonomy=row.taxonomy,
        last_test_status=row.last_test_status,
        last_test_message=row.last_test_message,
        last_tested_at=row.last_tested_at,
        use_polylang_linking=row.use_polylang_linking,
    )


@router.put("/wordpress", response_model=WordPressIntegrationRead)
def update_wordpress_integration(payload: WordPressIntegrationUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    row = _get_or_create_wp(db)
    if payload.site_url is not None:
        row.site_url = payload.site_url.strip()
    if payload.username is not None:
        row.username = payload.username.strip()
    if payload.app_password is not None:
        row.app_password = payload.app_password.strip()
    if payload.post_type is not None:
        row.post_type = payload.post_type.strip()
    if payload.taxonomy is not None:
        row.taxonomy = payload.taxonomy.strip()
    if payload.use_polylang_linking is not None:
        row.use_polylang_linking = payload.use_polylang_linking
    db.commit()
    return WordPressIntegrationRead(
        site_url=row.site_url,
        username=row.username,
        has_password=bool(row.app_password),
        post_type=row.post_type,
        taxonomy=row.taxonomy,
        last_test_status=row.last_test_status,
        last_test_message=row.last_test_message,
        last_tested_at=row.last_tested_at,
        use_polylang_linking=row.use_polylang_linking,
    )


@router.post("/wordpress/test", response_model=WordPressTestResult)
def test_wordpress(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = _get_or_create_wp(db)
    success, message = test_wordpress_connection(row.site_url, row.username, row.app_password)

    row.last_test_status = "success" if success else "failed"
    row.last_test_message = message
    row.last_tested_at = datetime.utcnow()
    db.commit()

    return WordPressTestResult(success=success, message=message)


@router.get("/languages", response_model=list[SupportedLanguageRead])
def list_languages(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(SupportedLanguage).order_by(SupportedLanguage.name).all()


@router.post("/languages", response_model=SupportedLanguageRead, status_code=201)
def add_language(payload: SupportedLanguageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.query(SupportedLanguage).filter(SupportedLanguage.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Language '{payload.code}' already exists")
    lang = SupportedLanguage(code=payload.code.lower().strip(), name=payload.name.strip())
    db.add(lang)
    db.commit()
    db.refresh(lang)
    return lang


@router.delete("/languages/{code}", status_code=204)
def delete_language(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lang = db.query(SupportedLanguage).filter(SupportedLanguage.code == code).first()
    if not lang:
        raise HTTPException(status_code=404, detail=f"Language '{code}' not found")
    db.delete(lang)
    db.commit()
