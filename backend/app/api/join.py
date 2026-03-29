"""Public join endpoint for team registration."""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import GameSession, Team, City
from app.core.security import get_password_hash, create_access_token
from app.core.config import settings
from app.core.logging import logger

router = APIRouter(prefix="/join", tags=["join"])


class JoinRequest(BaseModel):
    team_name: str
    password: str
    color: str


class JoinResponse(BaseModel):
    team_id: int
    team_name: str
    team_color: str
    auth_token: str
    session_id: int
    city_name: str
    game_started: bool


class SessionInfoResponse(BaseModel):
    session_id: int
    city_name: str
    duration_minutes: int
    is_active: bool
    team_count: int


@router.get("/{join_code}/info", response_model=SessionInfoResponse)
def get_session_info(
    join_code: str,
    db: Session = Depends(get_db)
):
    """Get info about a game session by join code (before registering)."""
    session = db.query(GameSession).filter(GameSession.join_code == join_code.upper()).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    if session.is_finished:
        raise HTTPException(status_code=400, detail="This game has already finished")
    
    city = db.query(City).filter(City.id == session.city_id).first()
    team_count = db.query(Team).filter(Team.game_session_id == session.id).count()
    
    return SessionInfoResponse(
        session_id=session.id,
        city_name=city.name if city else "Unknown",
        duration_minutes=session.duration_minutes,
        is_active=session.is_active,
        team_count=team_count
    )


@router.post("/{join_code}", response_model=JoinResponse, status_code=status.HTTP_201_CREATED)
def join_game(
    join_code: str,
    data: JoinRequest,
    db: Session = Depends(get_db)
):
    """Register a new team for a game session."""
    # Find session
    session = db.query(GameSession).filter(GameSession.join_code == join_code.upper()).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    if session.is_finished:
        raise HTTPException(status_code=400, detail="This game has already finished")
    
    if session.is_active:
        raise HTTPException(status_code=400, detail="Game has already started, no new teams can join")
    
    # Validate team name is unique within this session
    existing = db.query(Team).filter(
        Team.game_session_id == session.id,
        Team.name == data.team_name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Team name already taken in this game")
    
    # Validate color format
    if not data.color.startswith('#') or len(data.color) != 7:
        raise HTTPException(status_code=400, detail="Color must be in hex format (e.g. #FF0000)")
    
    # Create team
    team = Team(
        game_session_id=session.id,
        name=data.team_name,
        password_hash=get_password_hash(data.password),
        color=data.color,
        is_admin=False
    )
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Team name already taken in this game")
    db.refresh(team)
    
    # Create access token
    access_token_expires = timedelta(days=30)
    access_token = create_access_token(
        data={"sub": str(team.id)}, 
        expires_delta=access_token_expires
    )
    
    city = db.query(City).filter(City.id == session.city_id).first()
    
    logger.info(f"Team '{team.name}' joined session {session.id}")
    
    return JoinResponse(
        team_id=team.id,
        team_name=team.name,
        team_color=team.color,
        auth_token=access_token,
        session_id=session.id,
        city_name=city.name if city else "Unknown",
        game_started=session.is_active
    )
