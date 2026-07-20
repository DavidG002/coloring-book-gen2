import os
import time
from sqlalchemy.orm import Session

from database import SessionLocal
from models import GenerationJob, GenerationImage
from services.generation import generate_image_file

# In-memory cancel flags, keyed by job_id.
# Fine for a single-process, single-user local app — see note below.
_cancel_flags: set[int] = set()


def request_cancel(job_id: int):
    _cancel_flags.add(job_id)


def run_generation_job(job_id: int, tasks: list[dict], settings: dict):
    """Runs in the background via FastAPI's BackgroundTasks.
    Opens its OWN DB session — must not reuse the request's session,
    since that one closes as soon as the HTTP response is sent."""
    db: Session = SessionLocal()
    try:
        job = db.query(GenerationJob).get(job_id)
        job.status = "running"
        db.commit()

        for task in tasks:
            if job_id in _cancel_flags:
                job.status = "cancelled"
                db.commit()
                _cancel_flags.discard(job_id)
                return

            category_dir = os.path.join("output", task["category"])
            os.makedirs(category_dir, exist_ok=True)
            filename = f"{task['subject'].lower().replace(' ', '_')}_v{task['variation_number']:03d}.png"
            output_path = os.path.join(category_dir, filename)

            success = generate_image_file(task, settings, output_path)

            if success:
                db.add(GenerationImage(
                    job_id=job_id,
                    category=task["category"],
                    subject=task["subject"],
                    variation_number=task["variation_number"],
                    variation_text=task["variation_text"],
                    file_path=output_path,
                ))
                job.completed_images += 1
                db.commit()
                time.sleep(settings["sleep_between_calls"])
            else:
                time.sleep(settings["sleep_on_failure"])

        job.status = "done"
        db.commit()

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
    finally:
        _cancel_flags.discard(job_id)
        db.close()