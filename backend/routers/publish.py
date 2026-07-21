from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import Response
from services.publish import build_publish_plan, execute_publish, get_publish_history, generate_manifest_csv
from models import PublishRun

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
        result = build_publish_plan(db, payload.category, payload.lang, only_new=payload.only_new)
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
        result = execute_publish(db, payload.category, payload.lang, only_new=payload.only_new)
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
@router.get("/runs/{run_id}/manifest")
def download_run_manifest(run_id: int, db: Session = Depends(get_db)):
    try:
        csv_content = generate_manifest_csv(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=manifest-run-{run_id}.csv"},
    )

@router.get("/latest-manifest/{category_name}")
def download_latest_manifest(category_name: str, lang: str, db: Session = Depends(get_db)):
    latest = (
        db.query(PublishRun)
        .filter(PublishRun.category == category_name, PublishRun.lang == lang)
        .order_by(PublishRun.created_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail=f"No publish runs found for '{category_name}'/'{lang}'")

    csv_content = generate_manifest_csv(db, latest.id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={category_name}-{lang}-manifest.csv"},
    )

@router.get("/output-path/{category_name}")
def get_output_path(category_name: str):
    import os
    output_path = os.path.abspath(os.path.join("output", category_name))
    publish_path = os.path.abspath(os.path.join("publish"))
    return {"output_path": output_path, "publish_root": publish_path}