from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import BackupSettings
from schemas import BackupSettingsRead, BackupSettingsUpdate, BackupRecordRead, BackupRestoreResponse
from services.backup import get_or_create_backup_settings, run_backup, get_backup_history, restore_backup

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/settings", response_model=BackupSettingsRead)
def get_settings_route(db: Session = Depends(get_db)):
    return get_or_create_backup_settings(db)


@router.put("/settings", response_model=BackupSettingsRead)
def update_settings_route(payload: BackupSettingsUpdate, db: Session = Depends(get_db)):
    row = get_or_create_backup_settings(db)
    if payload.auto_backup_enabled is not None:
        row.auto_backup_enabled = payload.auto_backup_enabled
    if payload.backup_interval_hours is not None:
        row.backup_interval_hours = payload.backup_interval_hours
    if payload.local_retention_count is not None:
        row.local_retention_count = payload.local_retention_count
    db.commit()
    db.refresh(row)
    return row


@router.post("/run", response_model=BackupRecordRead)
def run_backup_route(db: Session = Depends(get_db)):
    try:
        record = run_backup(db, triggered_by="manual")
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")

    return BackupRecordRead(
        timestamp=record.folder_path.split("/")[-1],
        db_size_bytes=record.db_size_bytes,
        content_size_bytes=record.content_size_bytes,
        triggered_by=record.triggered_by,
        success=record.success,
        error_message=record.error_message,
    )
    
    
@router.get("/history", response_model=list[BackupRecordRead])
def history_route(db: Session = Depends(get_db)):
    return get_backup_history(db)


@router.post("/restore/{timestamp}", response_model=BackupRestoreResponse)
def restore_backup_route(timestamp: str, db: Session = Depends(get_db)):
    try:
        safety = run_backup(db, triggered_by="pre-restore")
        restored = restore_backup(db, timestamp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {e}")
    return BackupRestoreResponse(
        restored_from_timestamp=restored,
        safety_backup_timestamp=safety.folder_path.split("/")[-1],
        message="Restore complete. Restart the backend server for the restored data to take effect.",
    )
