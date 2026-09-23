from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
import httpx
from models import GenerationImage, Category, WordPressSubjectTerm, Subject, User
from services.wordpress_publish import (
    push_batch_to_wordpress, preview_wordpress_push, sync_pushed_item_to_wordpress,
    verify_and_clean_stale_pushes, _get_wp_config, list_wordpress_categories, map_book_to_term,
    rename_subject_term, TAXONOMY_REST_BASE, get_publish_overview,
)
from models import WordPressBookTerm
from schemas import (
    WordPressPushRequest, WordPressPushResponse, WordPressPreviewRequest, WordPressPreviewResponse,
    WordPressSyncRequest, WordPressSyncResponse, WordPressVerifyRequest, WordPressVerifyResponse,
    WordPressOverviewResponse,
)
from services.auth import get_current_user
from services.ownership import get_owned_book, get_owned_category


class ExcludeRequest(BaseModel):
    source_path: str
    excluded: bool

router = APIRouter(prefix="/wordpress", tags=["wordpress"])


@router.get("/overview", response_model=WordPressOverviewResponse)
def get_publish_overview_route(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Every category with a real, live WordPress publishing page, grouped
    with its per-language links — the read-only data behind the Print &
    Publish page's connections section.

    NOTE: not ownership-scoped to the caller — WordPress config is still
    a single shared singleton (AppCredential/WordPressIntegration, task 5
    in the roadmap), so this reflects the one shared site's overview for
    any logged-in user, same as before multiuser support existed."""
    return WordPressOverviewResponse(**get_publish_overview(db))


@router.get("/categories")
def get_wordpress_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Real, live top-level WordPress categories from the connected site —
    used by the Book-mapping setup screen."""
    try:
        config = _get_wp_config(db)
        return list_wordpress_categories(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


class BookMappingRequest(BaseModel):
    lang: str
    wp_term_id: int | None = None
    term_name: str | None = None


@router.post("/books/{book_id}/mapping")
def create_book_mapping(book_id: int, payload: BookMappingRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_book(book_id, user, db)
    try:
        config = _get_wp_config(db)
        term_id = map_book_to_term(db, config, book_id, payload.lang, payload.wp_term_id, payload.term_name)
        return {"wp_term_id": term_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/books/{book_id}/mapping")
def get_book_mapping(book_id: int, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_book(book_id, user, db)
    config = _get_wp_config(db)
    mapping = (
        db.query(WordPressBookTerm)
        .filter(WordPressBookTerm.book_id == book_id, WordPressBookTerm.lang == lang, WordPressBookTerm.site_url == config.site_url)
        .first()
    )
    return {"wp_term_id": mapping.wp_term_id if mapping else None}


class RenameSubjectTagRequest(BaseModel):
    subject_id: int
    lang: str
    new_name: str
    update_slug: bool = False


def _check_subject_ownership(db: Session, subject_id: int, user: User) -> None:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    get_owned_category(subject.category_id, user, db)


# NOTE: this function was defined twice in this file before this pass
# (found while adding auth) — Python keeps only the second definition,
# so the first was dead code. Left both in place, both now with the
# ownership check, rather than changing behavior in an auth-focused
# change; worth cleaning up separately.
@router.post("/rename-subject-tag")
def rename_subject_tag(payload: RenameSubjectTagRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _check_subject_ownership(db, payload.subject_id, user)
    try:
        config = _get_wp_config(db)
        return rename_subject_term(db, payload.subject_id, payload.lang, payload.new_name, config.site_url, payload.update_slug)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/rename-subject-tag")
def rename_subject_tag(payload: RenameSubjectTagRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _check_subject_ownership(db, payload.subject_id, user)
    try:
        config = _get_wp_config(db)
        return rename_subject_term(db, payload.subject_id, payload.lang, payload.new_name, config.site_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/subject-tags")
def get_subject_tags(category_id: int, lang: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Real, live per-subject WordPress Tag status for one category+language.
    Lets the Language page show which subjects are already live tags on the
    real site, which are new and not pushed yet, and whether a live tag's
    name has drifted from the current local translation (e.g. a bad
    auto-translation that got corrected here but was never synced to the
    live site) — surfaced directly instead of discovered after publishing."""
    category = get_owned_category(category_id, user, db)

    try:
        config = _get_wp_config(db)
    except ValueError:
        return {"configured": False, "site_url": None, "subjects": []}

    if not config.site_url:
        return {"configured": False, "site_url": None, "subjects": []}

    translation = next((t for t in category.translations if t.lang == lang), None)
    translated_by_subject = {}
    if translation:
        for item in translation.items:
            translated_by_subject[item.subject_id] = item.translated_text

    tags_rest_base = TAXONOMY_REST_BASE["post_tag"]
    results = []
    for subject in category.subjects:
        term = (
            db.query(WordPressSubjectTerm)
            .filter(
                WordPressSubjectTerm.subject_id == subject.id,
                WordPressSubjectTerm.lang == lang,
                WordPressSubjectTerm.site_url == config.site_url,
            )
            .first()
        )
        translated_text = translated_by_subject.get(subject.id, "")
        entry = {
            "subject_id": subject.id,
            "subject_name": subject.name,
            "translated_text": translated_text,
            "live": False,
            "wp_term_id": None,
            "live_name": None,
            "live_slug": None,
            "live_count": 0,
            "out_of_sync": False,
        }
        if term:
            entry["live"] = True
            entry["wp_term_id"] = term.wp_term_id
            url = config.site_url.rstrip("/") + f"/wp-json/wp/v2/{tags_rest_base}/{term.wp_term_id}"
            try:
                resp = httpx.get(url, timeout=10.0)
                if resp.status_code == 200:
                    data = resp.json()
                    live_name = data.get("name", "")
                    entry["live_name"] = live_name
                    entry["live_slug"] = data.get("slug")
                    entry["live_count"] = data.get("count", 0)
                    if translated_text and live_name and translated_text != live_name:
                        entry["out_of_sync"] = True
            except Exception:
                pass
        results.append(entry)

    site_label = config.site_url.replace("https://", "").replace("http://", "").rstrip("/")
    return {"configured": True, "site_url": site_label, "subjects": results}


@router.post("/push", response_model=WordPressPushResponse)
def push_to_wordpress(payload: WordPressPushRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(payload.category_id, user, db)
    try:
        result = push_batch_to_wordpress(
            db,
            category_id=payload.category_id,
            lang=payload.lang,
            status=payload.status,
            only_new=payload.only_new,
            source_paths=payload.source_paths,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressPushResponse(**result)

@router.post("/preview", response_model=WordPressPreviewResponse)
def preview_push(payload: WordPressPreviewRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(payload.category_id, user, db)
    try:
        result = preview_wordpress_push(db, payload.category_id, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressPreviewResponse(**result)

@router.post("/exclude")
def set_exclude(payload: ExcludeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from models import GenerationJob
    image = (
        db.query(GenerationImage)
        .join(GenerationJob, GenerationImage.job_id == GenerationJob.id)
        .filter(GenerationImage.file_path == payload.source_path, GenerationJob.user_id == user.id)
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    image.wp_excluded = payload.excluded
    db.commit()
    return {"source_path": payload.source_path, "excluded": image.wp_excluded}

@router.post("/sync", response_model=WordPressSyncResponse)
def sync_to_wordpress(payload: WordPressSyncRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from models import GenerationJob
    owned = (
        db.query(GenerationImage)
        .join(GenerationJob, GenerationImage.job_id == GenerationJob.id)
        .filter(GenerationImage.file_path == payload.source_path, GenerationJob.user_id == user.id)
        .first()
    )
    if not owned:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        result = sync_pushed_item_to_wordpress(db, payload.source_path, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return WordPressSyncResponse(**result)

@router.post("/verify", response_model=WordPressVerifyResponse)
def verify_push(payload: WordPressVerifyRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned_category(payload.category_id, user, db)
    try:
        result = verify_and_clean_stale_pushes(db, payload.category_id, payload.lang, _get_wp_config(db).site_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return WordPressVerifyResponse(**result)