from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import json

from database import get_db
from models import GenerationJob, GenerationImage, Category
from schemas import (
    GenerationPlanRequest, GenerationPlanResponse, PlannedTask,
    GenerationRunRequest, GenerationRunResponse, GenerationStatusResponse,
    GenerationPairsPlanRequest, GenerationPairsRunRequest, PairGenerationCounts,
)
from services.generation import build_task_list, build_task_list_from_pairs, get_pair_generation_counts, COST_PER_IMAGE_USD
from services.job_runner import run_generation_job, request_cancel
from routers.settings import get_settings as get_settings_route, DEFAULTS

router = APIRouter(prefix="/generate", tags=["generation"])


def _get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
    return category


def _load_settings_dict(db: Session, category: Category) -> dict:
    if not category.book:
        raise HTTPException(status_code=400, detail=f"Category '{category.name}' has no associated book")
    book = category.book
    return {
        "canvas_width": book.canvas_width,
        "canvas_height": book.canvas_height,
        "subject_size_ratio": book.subject_size_ratio,
        "white_clean_threshold": book.white_clean_threshold,
        "black_clean_threshold": book.black_clean_threshold,
        "palette_colors": book.palette_colors,
        "sleep_between_calls": get_settings_route(db).sleep_between_calls,
        "sleep_on_failure": get_settings_route(db).sleep_on_failure,
        "watermark_enabled": book.watermark_enabled,
        "watermark_book_id": book.id,
        "watermark_position": book.watermark_position,
        "watermark_opacity": book.watermark_opacity,
        "watermark_scale": book.watermark_scale,
    }


@router.post("/plan", response_model=GenerationPlanResponse)
def plan_generation(payload: GenerationPlanRequest, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, payload.category_id)
    try:
        tasks = build_task_list(
            db, category.name, payload.subjects,
            payload.new_variations_per_subject, payload.max_images,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return GenerationPlanResponse(
        tasks=[PlannedTask(**t) for t in tasks],
        total_images=len(tasks),
        estimated_cost_usd=round(len(tasks) * COST_PER_IMAGE_USD, 4),
    )


@router.post("/run", response_model=GenerationRunResponse)
def run_generation(payload: GenerationRunRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, payload.category_id)
    try:
        tasks = build_task_list(
            db, category.name, payload.subjects,
            payload.new_variations_per_subject, payload.max_images,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not tasks:
        raise HTTPException(status_code=400, detail="No images to generate for this request")

    job = GenerationJob(
        category=category.name,
        params_json=json.dumps(payload.model_dump()),
        status="pending",
        total_images=len(tasks),
        completed_images=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    settings = _load_settings_dict(db, category)
    background_tasks.add_task(run_generation_job, job.id, tasks, settings)

    return GenerationRunResponse(job_id=job.id, status=job.status, total_images=job.total_images)


@router.get("/status/{job_id}", response_model=GenerationStatusResponse)
def get_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    last_image = (
        db.query(GenerationImage)
        .filter(GenerationImage.job_id == job_id)
        .order_by(GenerationImage.id.desc())
        .first()
    )
    current_task = f"{last_image.subject} v{last_image.variation_number}" if last_image else None

    return GenerationStatusResponse(
        job_id=job.id,
        status=job.status,
        total_images=job.total_images,
        completed_images=job.completed_images,
        error_message=job.error_message,
        current_task=current_task,
    )


@router.post("/cancel/{job_id}")
def cancel_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Job is already '{job.status}', cannot cancel")
    request_cancel(job_id)
    return {"detail": f"Cancel requested for job {job_id}"}


@router.post("/plan-pairs", response_model=GenerationPlanResponse)
def plan_generation_pairs(payload: GenerationPairsPlanRequest, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, payload.category_id)
    try:
        tasks = build_task_list_from_pairs(
            db, category.name, [p.model_dump() for p in payload.pairs]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return GenerationPlanResponse(
        tasks=[PlannedTask(**t) for t in tasks],
        total_images=len(tasks),
        estimated_cost_usd=round(len(tasks) * COST_PER_IMAGE_USD, 4),
    )


@router.post("/run-pairs", response_model=GenerationRunResponse)
def run_generation_pairs(payload: GenerationPairsRunRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, payload.category_id)
    try:
        tasks = build_task_list_from_pairs(
            db, category.name, [p.model_dump() for p in payload.pairs]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not tasks:
        raise HTTPException(status_code=400, detail="No images to generate for this request")

    job = GenerationJob(
        category=category.name,
        params_json=json.dumps(payload.model_dump()),
        status="pending",
        total_images=len(tasks),
        completed_images=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    settings = _load_settings_dict(db, category)
    background_tasks.add_task(run_generation_job, job.id, tasks, settings)

    return GenerationRunResponse(job_id=job.id, status=job.status, total_images=job.total_images)


@router.get("/pair-counts/{category_id}", response_model=PairGenerationCounts)
def pair_counts(category_id: int, db: Session = Depends(get_db)):
    category = _get_category_or_404(db, category_id)
    return PairGenerationCounts(counts=get_pair_generation_counts(db, category.name))