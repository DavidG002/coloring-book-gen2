from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import AppCredential, WordPressIntegration, SupportedLanguage
from schemas import (
    OpenAIKeyRead, OpenAIKeyUpdate,
    WordPressIntegrationRead, WordPressIntegrationUpdate, WordPressTestResult,
    SupportedLanguageRead, SupportedLanguageCreate,
)
from services.wordpress import mask_key, test_wordpress_connection

router = APIRouter(prefix="/account", tags=["account"])


def _get_or_create_credential(db: Session) -> AppCredential:
    row = db.query(AppCredential).filter(AppCredential.id == 1).first()
    if not row:
        row = AppCredential(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_wp(db: Session) -> WordPressIntegration:
    row = db.query(WordPressIntegration).filter(WordPressIntegration.id == 1).first()
    if not row:
        row = WordPressIntegration(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/openai-key", response_model=OpenAIKeyRead)
def get_openai_key(db: Session = Depends(get_db)):
    row = _get_or_create_credential(db)
    if not row.openai_api_key:
        return OpenAIKeyRead(has_key=False)
    return OpenAIKeyRead(has_key=True, masked_key=mask_key(row.openai_api_key))


@router.put("/openai-key", response_model=OpenAIKeyRead)
def update_openai_key(payload: OpenAIKeyUpdate, db: Session = Depends(get_db)):
    row = _get_or_create_credential(db)
    row.openai_api_key = payload.openai_api_key.strip()
    db.commit()
    return OpenAIKeyRead(has_key=True, masked_key=mask_key(row.openai_api_key))


@router.get("/wordpress", response_model=WordPressIntegrationRead)
def get_wordpress_integration(db: Session = Depends(get_db)):
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
    )


@router.put("/wordpress", response_model=WordPressIntegrationRead)
def update_wordpress_integration(payload: WordPressIntegrationUpdate, db: Session = Depends(get_db)):
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
    )


@router.post("/wordpress/test", response_model=WordPressTestResult)
def test_wordpress(db: Session = Depends(get_db)):
    row = _get_or_create_wp(db)
    success, message = test_wordpress_connection(row.site_url, row.username, row.app_password)

    row.last_test_status = "success" if success else "failed"
    row.last_test_message = message
    row.last_tested_at = datetime.utcnow()
    db.commit()

    return WordPressTestResult(success=success, message=message)


@router.get("/languages", response_model=list[SupportedLanguageRead])
def list_languages(db: Session = Depends(get_db)):
    return db.query(SupportedLanguage).order_by(SupportedLanguage.name).all()


@router.post("/languages", response_model=SupportedLanguageRead, status_code=201)
def add_language(payload: SupportedLanguageCreate, db: Session = Depends(get_db)):
    existing = db.query(SupportedLanguage).filter(SupportedLanguage.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Language '{payload.code}' already exists")
    lang = SupportedLanguage(code=payload.code.lower().strip(), name=payload.name.strip())
    db.add(lang)
    db.commit()
    db.refresh(lang)
    return lang


@router.delete("/languages/{code}", status_code=204)
def delete_language(code: str, db: Session = Depends(get_db)):
    lang = db.query(SupportedLanguage).filter(SupportedLanguage.code == code).first()
    if not lang:
        raise HTTPException(status_code=404, detail=f"Language '{code}' not found")
    db.delete(lang)
    db.commit()
