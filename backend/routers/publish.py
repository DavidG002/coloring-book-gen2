from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from database import get_db
from services.publish import build_publish_plan, execute_publish, get_publish_history
from schemas import (
    PublishRequest, PublishPlanResponse, PublishedFileInfo, PublishRunResponse,
    PublishHistoryRunRead, PublishHistoryFileRead,
)

router = APIRouter(prefix="/publish", tags=["publish"])


@router.post("/plan", response_model=PublishPlanResponse)
def plan_publish(payload: PublishRequest, db: Session = Depends(get_db)):
    try:
        result = build_publish_plan(db, payload.category, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PublishPlanResponse(
        files=[PublishedFileInfo(**f) for f in result["files"]],
        total_files=len(result["files"]),
        new_count=result["new_count"],
        already_published_count=result["already_published_count"],
        skipped_subjects=result["skipped_subjects"],
    )


@router.post("/run", response_model=PublishRunResponse)
def run_publish(payload: PublishRequest, db: Session = Depends(get_db)):
    try:
        result = execute_publish(db, payload.category, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PublishRunResponse(**result)


@router.get("/history/{category_name}", response_model=list[PublishHistoryRunRead])
def publish_history(category_name: str, lang: str | None = None, db: Session = Depends(get_db)):
    runs = get_publish_history(db, category_name, lang)
    return [
        PublishHistoryRunRead(
            id=r.id,
            category=r.category,
            lang=r.lang,
            published_count=r.published_count,
            new_count=r.new_count,
            already_published_count=r.already_published_count,
            manifest_path=r.manifest_path,
            created_at=r.created_at,
            files=[PublishHistoryFileRead.model_validate(f) for f in r.files],
        )
        for r in runs
    ]
