"""Game management endpoints (admin only)."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.db.models import GameSession, Team
from app.core.security import get_current_admin, get_current_team
from app.core.logging import logger
from app.services.auto_export import ensure_auto_export_for_session

router = APIRouter(prefix="/game", tags=["game"])


# Schemas
class GameStatus(BaseModel):
    is_active: bool
    start_time: datetime | None = None
    end_time: datetime | None = None
    duration_minutes: int | None = None
    published_at: datetime | None = None
    is_published: bool = False
    city_name: str | None = None
    remaining_seconds: int | None = None
    is_finished: bool = False
    can_submit: bool = False


class StartGameRequest(BaseModel):
    duration_minutes: int = Field(..., gt=0, description="Game duration in minutes")


class GameResponse(BaseModel):
    id: int
    is_active: bool
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    published_at: datetime | None


@router.get("/status", response_model=GameStatus)
def get_game_status(
    db: Session = Depends(get_db),
    current_team: Team = Depends(get_current_team)
):
    """Get current game status for the logged-in team's session."""
    # Find the active game session for this team
    if current_team.is_admin:
        # Admin sees any active session
        session = db.query(GameSession).filter(GameSession.is_active == True).first()
    else:
        # Regular team sees their own session
        session = db.query(GameSession).filter(
            GameSession.id == current_team.game_session_id
        ).first()
    
    if not session or not session.is_active:
        return GameStatus(is_active=False)
    
    now = datetime.utcnow()
    is_finished = now >= session.end_time
    time_remaining = max(0, (session.end_time - now).total_seconds())

    # Auto-close and auto-export once session end time is reached.
    if is_finished and not session.is_finished:
        session.is_finished = True
        session.is_active = False
        db.commit()
        ensure_auto_export_for_session(db, session.id)
    
    return GameStatus(
        is_active=True,
        start_time=session.started_at,
        end_time=session.end_time,
        duration_minutes=session.duration_minutes,
        published_at=session.published_at,
        is_published=(session.published_at is not None),
        city_name=session.city.name,
        remaining_seconds=int(time_remaining),
        is_finished=is_finished,
        can_submit=(not is_finished and session.is_active)
    )


# NOTE: Game start is now handled through /admin/sessions/{session_id}/start endpoint
# This deprecated endpoint has been removed


@router.post("/publish")
def publish_results(
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """
    Publish game results - makes all submissions visible to everyone.
    Admin only, and game must be finished.
    """
    session = db.query(GameSession).filter(GameSession.is_active == True).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active game session found"
        )
    
    now = datetime.utcnow()
    if now < session.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish results before game ends"
        )
    
    if session.published_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Results already published"
        )
    
    session.published_at = now
    session.is_finished = True
    db.commit()
    
    logger.info(f"Game session {session.id} results published by admin {admin.name}")
    
    return {"message": "Results published successfully", "published_at": now}
