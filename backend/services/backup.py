import os
import shutil
import sqlite3
import subprocess
import tarfile
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.engine import make_url

from models import BackupSettings, BackupRecord, engine, DATABASE_URL

BACKUP_DIR = "backups"
CONTENT_FOLDERS = ["output", "publish", "watermarks"]
DB_PATH = "data.db"  # SQLite only — see _is_postgres() below


def _is_postgres() -> bool:
    return engine.dialect.name == "postgresql"


def _pg_dump(dest_path: str):
    """Dumps the whole Postgres database to dest_path using pg_dump's
    custom format (-Fc) — compact, and restorable with pg_restore.
    Requires the postgresql-client package (pg_dump/pg_restore binaries),
    installed in backend/Dockerfile."""
    url = make_url(DATABASE_URL)
    env = os.environ.copy()
    if url.password:
        env["PGPASSWORD"] = url.password
    cmd = [
        "pg_dump",
        "-h", url.host or "localhost",
        "-p", str(url.port or 5432),
        "-U", url.username or "",
        "-Fc",
        "-f", dest_path,
        url.database,
    ]
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"pg_dump failed: {result.stderr.strip()}")


def _pg_restore(dump_path: str):
    """Restores a pg_dump custom-format file into the current database.
    --clean --if-exists drops existing objects first so the restore
    isn't blocked by things already present; --no-owner/--no-privileges
    avoids failing over role names that may differ between environments."""
    url = make_url(DATABASE_URL)
    env = os.environ.copy()
    if url.password:
        env["PGPASSWORD"] = url.password
    cmd = [
        "pg_restore",
        "-h", url.host or "localhost",
        "-p", str(url.port or 5432),
        "-U", url.username or "",
        "-d", url.database,
        "--clean", "--if-exists", "--no-owner", "--no-privileges",
        dump_path,
    ]
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"pg_restore failed: {result.stderr.strip()}")


def _find_db_backup_file(folder: str) -> str | None:
    """A backup folder holds exactly one of these, depending on which
    database engine created it: postgres.dump (current, Postgres) or
    data.db (legacy, SQLite). Checking both keeps old local backups
    readable even after moving to Postgres."""
    for name in ("postgres.dump", "data.db"):
        path = os.path.join(folder, name)
        if os.path.exists(path):
            return path
    return None


def get_or_create_backup_settings(db: Session) -> BackupSettings:
    row = db.query(BackupSettings).filter(BackupSettings.id == 1).first()
    if not row:
        row = BackupSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def run_backup(db: Session, triggered_by: str = "manual") -> BackupRecord:
    """Runs a real backup: a full database dump (pg_dump on Postgres; a
    safe SQLite snapshot via SQLite's own backup API on the legacy local
    setup) plus a tarball of real generated content. Rotates old local
    backups per the configured retention count. Never touches any
    off-site copy — that's a separate, additive layer."""
    if triggered_by == "manual":
        last_manual = (
            db.query(BackupRecord)
            .filter(BackupRecord.triggered_by == "manual", BackupRecord.success == True)
            .order_by(BackupRecord.created_at.desc())
            .first()
        )
        if last_manual and datetime.utcnow() - last_manual.created_at < timedelta(minutes=5):
            raise ValueError("Please wait a few minutes between manual backups.")

    settings = get_or_create_backup_settings(db)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    folder = os.path.join(BACKUP_DIR, timestamp)
    os.makedirs(folder, exist_ok=True)

    content_backup_path = os.path.join(folder, "content.tar.gz")

    try:
        if _is_postgres():
            db_backup_path = os.path.join(folder, "postgres.dump")
            _pg_dump(db_backup_path)
        else:
            db_backup_path = os.path.join(folder, "data.db")
            source = sqlite3.connect(DB_PATH)
            dest = sqlite3.connect(db_backup_path)
            with dest:
                source.backup(dest)
            source.close()
            dest.close()
        db_size = os.path.getsize(db_backup_path)

        with tarfile.open(content_backup_path, "w:gz") as tar:
            for name in CONTENT_FOLDERS:
                if os.path.isdir(name):
                    tar.add(name, arcname=name)
        content_size = os.path.getsize(content_backup_path) if os.path.exists(content_backup_path) else 0

        record = BackupRecord(
            folder_path=folder,
            db_size_bytes=db_size,
            content_size_bytes=content_size,
            triggered_by=triggered_by,
            success=True,
        )
        db.add(record)

        settings.last_backup_at = datetime.utcnow()

        _rotate_old_backups(settings.local_retention_count)

        db.commit()
        db.refresh(record)
        return record

    except Exception as e:
        shutil.rmtree(folder, ignore_errors=True)
        record = BackupRecord(folder_path=folder, triggered_by=triggered_by, success=False, error_message=str(e))
        db.add(record)
        db.commit()
        db.refresh(record)
        raise


def _rotate_old_backups(keep_count: int):
    if not os.path.isdir(BACKUP_DIR):
        return
    entries = sorted(
        (e for e in os.listdir(BACKUP_DIR) if os.path.isdir(os.path.join(BACKUP_DIR, e))),
        reverse=True,
    )
    for old in entries[keep_count:]:
        shutil.rmtree(os.path.join(BACKUP_DIR, old), ignore_errors=True)


def maybe_run_auto_backup(db: Session):
    """Called on app startup — since this is a locally-run tool, not an
    always-on server, there's no cron equivalent; checking on startup is
    the correct substitute for a scheduled job."""
    settings = get_or_create_backup_settings(db)
    if not settings.auto_backup_enabled:
        return

    if settings.last_backup_at is None:
        run_backup(db, triggered_by="auto")
        return

    if datetime.utcnow() - settings.last_backup_at >= timedelta(hours=settings.backup_interval_hours):
        run_backup(db, triggered_by="auto")


def list_backups_from_disk() -> list[dict]:
    """The real source of truth for what backups exist — reads directly from
    disk rather than trusting BackupRecord rows, which live inside the
    database itself and can be lost if a restore swaps in an older
    database. Cross-references BackupRecord opportunistically for extra
    metadata when available, but never depends on it being there."""
    if not os.path.isdir(BACKUP_DIR):
        return []

    results = []
    for name in sorted(os.listdir(BACKUP_DIR), reverse=True):
        folder = os.path.join(BACKUP_DIR, name)
        if not os.path.isdir(folder):
            continue
        db_path = _find_db_backup_file(folder)
        content_path = os.path.join(folder, "content.tar.gz")
        results.append({
            "timestamp": name,
            "db_size_bytes": os.path.getsize(db_path) if db_path else 0,
            "content_size_bytes": os.path.getsize(content_path) if os.path.exists(content_path) else 0,
            "has_db": db_path is not None,
        })
    return results


def get_backup_history(db: Session, limit: int = 20) -> list[dict]:
    """Merges the real, disk-derived backup list with whatever metadata
    (triggered_by, success) happens to still exist in the current database."""
    disk_backups = list_backups_from_disk()[:limit]
    known_records = {r.folder_path: r for r in db.query(BackupRecord).all()}

    merged = []
    for b in disk_backups:
        folder_path = os.path.join(BACKUP_DIR, b["timestamp"])
        record = known_records.get(folder_path)
        merged.append({
            "timestamp": b["timestamp"],
            "db_size_bytes": b["db_size_bytes"],
            "content_size_bytes": b["content_size_bytes"],
            "triggered_by": record.triggered_by if record else "unknown",
            "success": b["has_db"],
            "error_message": record.error_message if record else None,
        })
    return merged


def restore_backup(db: Session, timestamp: str) -> str:
    """Restores from a backup identified by its folder timestamp — always
    resolvable directly from disk, unlike a database-row ID which can be
    lost if a restore swaps in an older database that never knew about it.
    Uses pg_restore on Postgres, or a plain file copy for a legacy SQLite
    backup folder."""
    folder = os.path.join(BACKUP_DIR, timestamp)
    if not os.path.isdir(folder):
        raise ValueError(f"Backup '{timestamp}' not found on disk")

    db_backup_path = _find_db_backup_file(folder)
    content_backup_path = os.path.join(folder, "content.tar.gz")

    if not db_backup_path:
        raise ValueError(f"Backup '{timestamp}' has no database file")

    if db_backup_path.endswith("postgres.dump"):
        _pg_restore(db_backup_path)
    else:
        shutil.copy2(db_backup_path, DB_PATH)

    if os.path.exists(content_backup_path):
        for name in CONTENT_FOLDERS:
            if os.path.isdir(name):
                shutil.rmtree(name)
        with tarfile.open(content_backup_path, "r:gz") as tar:
            tar.extractall(".")

    return timestamp
