"""Tikker role management: tag initiation, confirmation, denial, and status."""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Team, TikkerPeriod, TikkerTransferRequest
from app.core.security import get_current_team

router = APIRouter(prefix="/tikker", tags=["tikker"])


class TagRequest(BaseModel):
    target_team_id: int


class TeamInfo(BaseModel):
    id: int
    name: str
    color: str
    is_tikker: bool


def _close_tikker_period(db: Session, team_id: int, game_session_id: int, ended_at: datetime):
    period = (
        db.query(TikkerPeriod)
        .filter(
            TikkerPeriod.team_id == team_id,
            TikkerPeriod.game_session_id == game_session_id,
            TikkerPeriod.ended_at.is_(None),
        )
        .first()
    )
    if period:
        period.ended_at = ended_at


def _open_tikker_period(db: Session, team_id: int, game_session_id: int, started_at: datetime):
    db.add(TikkerPeriod(
        team_id=team_id,
        game_session_id=game_session_id,
        started_at=started_at,
    ))


@router.get("/status")
def get_tikker_status(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Return current tikker state for the calling team's session."""
    if not team.game_session_id:
        return {"tikker_team_id": None, "tikker_team_name": None, "tikker_team_color": None,
                "is_tikker": False, "pending_request": None}

    tikker = (
        db.query(Team)
        .filter(Team.game_session_id == team.game_session_id, Team.is_tikker == True)
        .first()
    )

    pending = (
        db.query(TikkerTransferRequest)
        .filter(
            TikkerTransferRequest.game_session_id == team.game_session_id,
            TikkerTransferRequest.status == "PENDING",
        )
        .first()
    )

    pending_info = None
    if pending:
        initiating = db.query(Team).filter(Team.id == pending.initiating_team_id).first()
        target = db.query(Team).filter(Team.id == pending.target_team_id).first()
        pending_info = {
            "id": pending.id,
            "initiating_team_id": pending.initiating_team_id,
            "initiating_team_name": initiating.name if initiating else None,
            "target_team_id": pending.target_team_id,
            "target_team_name": target.name if target else None,
            "created_at": pending.created_at,
        }

    return {
        "tikker_team_id": tikker.id if tikker else None,
        "tikker_team_name": tikker.name if tikker else None,
        "tikker_team_color": tikker.color if tikker else None,
        "is_tikker": team.is_tikker,
        "pending_request": pending_info,
    }


@router.post("/tag")
def tag_team(
    body: TagRequest,
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Tikker initiates a tag by selecting which team they caught."""
    if not team.is_tikker:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alleen de tikker kan een tag starten")

    if not team.game_session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Je bent niet in een spel")

    if body.target_team_id == team.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Je kunt jezelf niet tikken")

    target = (
        db.query(Team)
        .filter(Team.id == body.target_team_id, Team.game_session_id == team.game_session_id, Team.is_admin == False)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team niet gevonden in dit spel")

    existing = (
        db.query(TikkerTransferRequest)
        .filter(
            TikkerTransferRequest.game_session_id == team.game_session_id,
            TikkerTransferRequest.status == "PENDING",
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Er is al een openstaand tikverzoek")

    db.add(TikkerTransferRequest(
        game_session_id=team.game_session_id,
        initiating_team_id=team.id,
        target_team_id=body.target_team_id,
        status="PENDING",
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return {"message": f"Tikverzoek verstuurd naar {target.name}"}


@router.post("/confirm")
def confirm_tag(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Tagged team confirms; tikker role transfers to them."""
    if not team.game_session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Je bent niet in een spel")

    pending = (
        db.query(TikkerTransferRequest)
        .filter(
            TikkerTransferRequest.game_session_id == team.game_session_id,
            TikkerTransferRequest.target_team_id == team.id,
            TikkerTransferRequest.status == "PENDING",
        )
        .first()
    )
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Geen openstaand tikverzoek voor jouw team")

    now = datetime.utcnow()

    old_tikker = db.query(Team).filter(Team.id == pending.initiating_team_id).first()
    if old_tikker:
        _close_tikker_period(db, old_tikker.id, team.game_session_id, now)
        old_tikker.is_tikker = False

    _open_tikker_period(db, team.id, team.game_session_id, now)
    team.is_tikker = True

    pending.status = "CONFIRMED"
    pending.resolved_at = now

    db.commit()
    return {"message": "Tikker-rol overgedragen"}


@router.post("/deny")
def deny_tag(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Tagged team denies the tag; no role change."""
    if not team.game_session_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Je bent niet in een spel")

    pending = (
        db.query(TikkerTransferRequest)
        .filter(
            TikkerTransferRequest.game_session_id == team.game_session_id,
            TikkerTransferRequest.target_team_id == team.id,
            TikkerTransferRequest.status == "PENDING",
        )
        .first()
    )
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Geen openstaand tikverzoek voor jouw team")

    pending.status = "DENIED"
    pending.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Tikverzoek afgewezen"}


@router.get("/teams", response_model=List[TeamInfo])
def get_taggable_teams(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team),
):
    """Return all non-admin teams in the current session (for tikker tag panel)."""
    if not team.game_session_id:
        return []

    teams = (
        db.query(Team)
        .filter(
            Team.game_session_id == team.game_session_id,
            Team.is_admin == False,
            Team.id != team.id,
        )
        .order_by(Team.name)
        .all()
    )
    return [TeamInfo(id=t.id, name=t.name, color=t.color, is_tikker=t.is_tikker) for t in teams]
