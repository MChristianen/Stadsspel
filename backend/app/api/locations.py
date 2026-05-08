"""Live GPS location endpoints."""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Team, TeamLocation
from app.core.security import get_current_team

router = APIRouter(prefix="/locations", tags=["locations"])


class LocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class TeamLocationResponse(BaseModel):
    team_id: int
    team_name: str
    team_color: str
    latitude: float
    longitude: float
    updated_at: datetime


@router.post("/update", status_code=status.HTTP_204_NO_CONTENT)
def update_location(
    body: LocationUpdate,
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Upsert the calling team's GPS location."""
    if not team.game_session_id:
        raise HTTPException(status_code=400, detail="Je bent niet in een spel")

    existing = (
        db.query(TeamLocation)
        .filter(
            TeamLocation.team_id == team.id,
            TeamLocation.game_session_id == team.game_session_id,
        )
        .first()
    )
    now = datetime.utcnow()
    if existing:
        existing.latitude = body.latitude
        existing.longitude = body.longitude
        existing.updated_at = now
    else:
        db.add(TeamLocation(
            team_id=team.id,
            game_session_id=team.game_session_id,
            latitude=body.latitude,
            longitude=body.longitude,
            updated_at=now,
        ))
    db.commit()


@router.get("", response_model=List[TeamLocationResponse])
def get_locations(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Return all team locations in the session (tikker/admin only)."""
    if not team.game_session_id:
        return []

    if not team.is_tikker and not team.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alleen de tikker kan alle locaties zien")

    rows = (
        db.query(TeamLocation, Team)
        .join(Team, Team.id == TeamLocation.team_id)
        .filter(
            TeamLocation.game_session_id == team.game_session_id,
            Team.is_admin == False,
            Team.id != team.id,
        )
        .all()
    )

    return [
        TeamLocationResponse(
            team_id=loc.team_id,
            team_name=t.name,
            team_color=t.color,
            latitude=loc.latitude,
            longitude=loc.longitude,
            updated_at=loc.updated_at,
        )
        for loc, t in rows
    ]
