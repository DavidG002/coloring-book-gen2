import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Setting
from schemas import PromptDefaultsRead, PromptDefaultsUpdate

router = APIRouter(prefix="/defaults/prompt-template", tags=["prompt-defaults"])

# Seeded once, then fully editable from the frontend — this is a *starting*
# default, not a hardcoded fallback used at generation time.
FALLBACK_BASE_PROMPT = (
    "Simple black and white coloring page for children ages 3 to 10. "
    "Large main subject that fills most of the page with thick bold black outlines. "
    "Very minimal details and clean shapes that are easy to color. "
    "Large centered object with lots of white space around it. "
    "Minimal or no background. Clean white background. "
    "Simple friendly cartoon style, not overly babyish. "
    "High contrast thick lines, suitable for young children. "
    "Print-ready line art. "
)

FALLBACK_VARIATIONS = [
    "facing left, full body side view, walking pose, curious expression",
    "facing right, full body side view, roaring with mouth wide open, excited",
    "front-facing, sitting down, big friendly smile, arms out",
    "three-quarter view from above, looking up at the sky, surprised expression",
    "full body, running pose, leaning forward with speed, determined look",
    "rear three-quarter view, looking back over shoulder with a cheeky grin",
    "low angle view, standing tall and proud, chest out, heroic pose",
    "full body, sleeping or resting, eyes closed, curled up peacefully",
    "jumping or leaping, all four limbs in the air, joyful expression",
    "full body, waving one arm at the viewer, big happy grin",
    "side view, head tilted down sniffing the ground, playful pose",
    "front-facing, arms crossed, pretending to look tough but still cute",
]

BASE_PROMPT_KEY = "default_base_prompt"
VARIATIONS_KEY = "default_variations_json"


def _ensure_seeded(db: Session):
    if not db.query(Setting).filter(Setting.key == BASE_PROMPT_KEY).first():
        db.add(Setting(key=BASE_PROMPT_KEY, value=FALLBACK_BASE_PROMPT))
    if not db.query(Setting).filter(Setting.key == VARIATIONS_KEY).first():
        db.add(Setting(key=VARIATIONS_KEY, value=json.dumps(FALLBACK_VARIATIONS)))
    db.commit()


@router.get("", response_model=PromptDefaultsRead)
def get_prompt_defaults(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    base_prompt = db.query(Setting).filter(Setting.key == BASE_PROMPT_KEY).first().value
    variations = json.loads(db.query(Setting).filter(Setting.key == VARIATIONS_KEY).first().value)
    return PromptDefaultsRead(base_prompt=base_prompt, variations=variations)


@router.put("", response_model=PromptDefaultsRead)
def update_prompt_defaults(payload: PromptDefaultsUpdate, db: Session = Depends(get_db)):
    _ensure_seeded(db)

    if payload.base_prompt is not None:
        setting = db.query(Setting).filter(Setting.key == BASE_PROMPT_KEY).first()
        setting.value = payload.base_prompt

    if payload.variations is not None:
        setting = db.query(Setting).filter(Setting.key == VARIATIONS_KEY).first()
        setting.value = json.dumps(payload.variations)

    db.commit()

    base_prompt = db.query(Setting).filter(Setting.key == BASE_PROMPT_KEY).first().value
    variations = json.loads(db.query(Setting).filter(Setting.key == VARIATIONS_KEY).first().value)
    return PromptDefaultsRead(base_prompt=base_prompt, variations=variations)