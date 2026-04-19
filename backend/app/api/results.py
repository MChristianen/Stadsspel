"""Public results endpoints."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import GameSession
from app.db.session import get_db
from app.services.export_zip import get_session_results_payload

router = APIRouter(prefix="/results", tags=["results"])


class PublicResultsResponse(BaseModel):
    session_id: int
    join_code: str
    city_name: str | None
    started_at: str | None
    end_time: str | None
    published_at: str | None
    is_finished: bool
    team_count: int
    area_count: int
    final_standings: list[dict]
    points_history: list[dict]


@router.get("/{join_code}", response_model=PublicResultsResponse)
def get_public_results(
    join_code: str,
    db: Session = Depends(get_db),
):
    """Get public end results and points history by join code."""
    session = db.query(GameSession).filter(GameSession.join_code == join_code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.end_time and datetime.utcnow() >= session.end_time and not session.is_finished:
        session.is_finished = True
        session.is_active = False
        db.commit()
        db.refresh(session)
    if not session.is_finished:
        raise HTTPException(status_code=400, detail="Results are not available yet")

    payload = get_session_results_payload(db, session)
    return PublicResultsResponse(**payload)
