from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Setting
from schemas import SettingsRead, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

# Defaults mirror the constants from the original generate_pages.py
DEFAULTS = {
    "canvas_width": "595",
    "canvas_height": "842",
    "subject_size_ratio": "0.50",
    "white_clean_threshold": "245",
    "black_clean_threshold": "10",
    "palette_colors": "8",
    "batch_confirmation_threshold": "15",
    "sleep_between_calls": "1.2",
    "sleep_on_failure": "5.0",
}

# Which defaults are floats vs ints, so we cast correctly on read
FLOAT_KEYS = {"subject_size_ratio", "sleep_between_calls", "sleep_on_failure"}


def _ensure_defaults(db: Session):
    """Seeds any missing settings with defaults. Safe to call every request —
    only inserts keys that don't already exist."""
    existing_keys = {s.key for s in db.query(Setting).all()}
    for key, value in DEFAULTS.items():
        if key not in existing_keys:
            db.add(Setting(key=key, value=value))
    db.commit()


def _cast(key: str, raw_value: str):
    return float(raw_value) if key in FLOAT_KEYS else int(raw_value)


@router.get("", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db)):
    _ensure_defaults(db)
    rows = {s.key: s.value for s in db.query(Setting).all()}
    return SettingsRead(**{key: _cast(key, rows[key]) for key in DEFAULTS})


@router.put("", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    _ensure_defaults(db)
    updates = payload.model_dump(exclude_unset=True)  # only fields actually sent

    for key, value in updates.items():
        setting = db.query(Setting).filter(Setting.key == key).first()
        setting.value = str(value)

    db.commit()

    rows = {s.key: s.value for s in db.query(Setting).all()}
    return SettingsRead(**{key: _cast(key, rows[key]) for key in DEFAULTS})