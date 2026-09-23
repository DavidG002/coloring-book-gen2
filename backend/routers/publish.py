from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import Response
from services.publish import build_publish_plan, execute_publish, get_publish_history, generate_manifest_csv, is_pairing_published, is_exact_file_published_in_all_langs
from models import PublishRun

import json

from database import get_db
from models import User
from services.publish import build_publish_plan, execute_publish, get_publish_history
from schemas import (
    PublishRequest, PublishPlanResponse, PublishedFileInfo, PublishRunResponse,
    PublishHistoryRunRead, PublishHistoryFileRead, OutputPathResponse,
)
from services.auth import get_current_user
from services.ownership import get_owned_category

router = APIRouter(prefix="/publish", tags=["publish"])


@router.post("/plan", response_model=PublishPlanResponse)
def plan_publish(payload: PublishRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(payload.category_id, user, db)
    try:
        image_ids_set = set(payload.image_ids) if payload.image_ids is not None else None
        result = build_publish_plan(db, payload.category_id, payload.lang, only_new=payload.only_new, image_ids=image_ids_set)
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
def run_publish(payload: PublishRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(payload.category_id, user, db)
    try:
        image_ids_set = set(payload.image_ids) if payload.image_ids is not None else None
        result = execute_publish(db, payload.category_id, payload.lang, only_new=payload.only_new, image_ids=image_ids_set, batch_id=payload.batch_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PublishRunResponse(**result)


@router.get("/history/{category_name}", response_model=list[PublishHistoryRunRead])
def publish_history(category_name: str, lang: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # NOTE: category_name is a free-text string here, not a foreign key —
    # PublishRun has no category_id/user_id column, so this can't be
    # ownership-scoped the way category_id-based endpoints above are.
    # Same class of gap as the deferred Book.name audit (task 6 in the
    # roadmap); this just requires login, it doesn't yet prevent one user
    # from seeing another's publish history for a same-named category.
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
def download_run_manifest(run_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Same residual gap as publish_history above — PublishRun isn't
    # linked to a user, only requires login for now.
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
def download_latest_manifest(category_name: str, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
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

@router.get("/output-path/{category_name}", response_model=OutputPathResponse)
def get_output_path(category_name: str, user: User = Depends(get_current_user)):
    import os
    output_path = os.path.abspath(os.path.join("output", category_name))
    publish_path = os.path.abspath(os.path.join("publish"))
    return {"output_path": output_path, "publish_root": publish_path}


@router.get("/pairing-published")
def check_pairing_published(category_id: int, subject: str, variation_text: str, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Real, per-pairing check — has ANY image of this (subject, variation)
    combination been published in this language before, regardless of
    which specific file. Temporary debug/test endpoint for Layer 1 of
    the pairing-level publish tracking design."""
    get_owned_category(category_id, user, db)
    published = is_pairing_published(db, category_id, subject, variation_text, lang)
    return {"published": published}


@router.post("/check-fully-published")
def check_fully_published(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Given a category and a list of images (each with an id, source_path,
    subject, variation_text), plus the real languages configured for that
    category, returns two things per image:
    - exact_file_blocked: this EXACT file is already live in every given
      language — genuinely nothing new to offer, caller should PREVENT
      adding it at all.
    - pairing_warning: a DIFFERENT file of the same pairing is already
      live in every given language — real, legitimate new content
      (different picture), caller should WARN but still allow adding."""
    category_id = payload["category_id"]
    images = payload["images"]
    langs = payload["langs"]
    get_owned_category(category_id, user, db)

    exact_file_blocked = []
    pairing_warning = []
    for img in images:
        if is_exact_file_published_in_all_langs(db, img["source_path"], category_id, langs):
            exact_file_blocked.append(img["id"])
        elif is_pairing_published_in_all_langs := all(
            is_pairing_published(db, category_id, img["subject"], img["variation_text"], lang) for lang in langs
        ):
            pairing_warning.append(img["id"])

    return {"exact_file_blocked": exact_file_blocked, "pairing_warning": pairing_warning}
