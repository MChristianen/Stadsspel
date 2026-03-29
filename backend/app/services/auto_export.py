"""Automatic export generation for finished sessions."""
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.services.export_zip import create_export_zip


def _auto_export_path(session_id: int) -> Path:
    export_dir = Path(settings.MEDIA_LOCAL_PATH) / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    return export_dir / f"session_{session_id}_auto.zip"


def ensure_auto_export_for_session(db: Session, session_id: int) -> Path:
    """
    Ensure automatic zip export exists for the given session.
    Returns the filesystem path to the export.
    """
    path = _auto_export_path(session_id)
    if path.exists():
        return path

    zip_buffer = create_export_zip(db, session_id)
    path.write_bytes(zip_buffer.getvalue())
    logger.info(f"Auto-export created for session {session_id}: {path}")
    return path


def auto_export_exists(session_id: int) -> bool:
    return _auto_export_path(session_id).exists()


def get_auto_export_path(session_id: int) -> Path:
    return _auto_export_path(session_id)
