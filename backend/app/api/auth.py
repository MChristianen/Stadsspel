"""Authentication endpoints: register and login."""
from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.db.models import Team, GameSession
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["auth"])

FAILED_LOGINS: dict[str, list[datetime]] = defaultdict(list)
LOCKED_UNTIL: dict[str, datetime] = {}
MAX_FAILED_ATTEMPTS = 5
ATTEMPT_WINDOW_MINUTES = 10
LOCK_MINUTES = 15


# Schemas
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6)
    photo_url: str | None = None
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")  # Hex color - auto-generated if not provided
    game_session_id: int | None = None  # Optional session ID to join


class LoginRequest(BaseModel):
    name: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    team_id: int
    team_name: str
    team_color: str
    is_admin: bool
    game_session_id: int | None = None


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new team account."""
    # Allow same team name in different sessions, but not within the same session.
    existing = db.query(Team).filter(
        Team.name == data.name,
        Team.is_admin == False,
        Team.game_session_id == data.game_session_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team name already used in this game session"
        )
    
    # Auto-generate color if not provided
    import random
    team_color = data.color
    if not team_color:
        # Generate a vibrant random color
        colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
            '#EC7063', '#AF7AC5', '#5DADE2', '#48C9B0', '#F4D03F'
        ]
        # Get already used colors to avoid duplicates
        used_colors = [t.color for t in db.query(Team).all()]
        available_colors = [c for c in colors if c not in used_colors]
        team_color = random.choice(available_colors) if available_colors else random.choice(colors)
    
    # Create new team
    team = Team(
        name=data.name,
        photo_url=data.photo_url,
        password_hash=get_password_hash(data.password),
        color=team_color,
        is_admin=False,  # Admins must be created manually or via seed
        game_session_id=data.game_session_id  # Link to session if provided
    )
    
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team name already used in this game session"
        )
    db.refresh(team)
    
    # Generate token
    access_token = create_access_token(data={"sub": team.id})
    
    logger.info(f"Registered new team: {team.name} (ID: {team.id})")
    
    return TokenResponse(
        access_token=access_token,
        team_id=team.id,
        team_name=team.name,
        team_color=team.color,
        is_admin=team.is_admin,
        game_session_id=team.game_session_id
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login with team credentials."""
    now = datetime.utcnow()
    client_key = data.name.strip().lower()
    locked_until = LOCKED_UNTIL.get(client_key)
    if locked_until and now < locked_until:
        remaining_seconds = int((locked_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {remaining_seconds} seconds."
        )

    # Support duplicate team names across sessions by checking all matches.
    candidates = db.query(Team).filter(Team.name == data.name).order_by(Team.created_at.desc()).all()
    matching = [candidate for candidate in candidates if verify_password(data.password, candidate.password_hash)]
    team = matching[0] if matching else None

    if not team:
        window_start = now - timedelta(minutes=ATTEMPT_WINDOW_MINUTES)
        recent_failures = [t for t in FAILED_LOGINS[client_key] if t >= window_start]
        recent_failures.append(now)
        FAILED_LOGINS[client_key] = recent_failures
        if len(recent_failures) >= MAX_FAILED_ATTEMPTS:
            LOCKED_UNTIL[client_key] = now + timedelta(minutes=LOCK_MINUTES)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect team name or password"
        )

    # Successful login: clear counters.
    FAILED_LOGINS.pop(client_key, None)
    LOCKED_UNTIL.pop(client_key, None)

    # If multiple matching credentials exist, prefer team in active session.
    if len(matching) > 1:
        active_team = (
            db.query(Team)
            .join(GameSession, Team.game_session_id == GameSession.id, isouter=True)
            .filter(Team.id.in_([m.id for m in matching]))
            .filter(GameSession.is_active == True)
            .order_by(Team.created_at.desc())
            .first()
        )
        if active_team:
            team = active_team
        else:
            # If no active-session match exists, prefer a team linked to any session
            # over legacy standalone accounts without game_session_id.
            session_linked_team = next(
                (candidate for candidate in matching if candidate.game_session_id is not None),
                None
            )
            if session_linked_team:
                team = session_linked_team
    
    # Generate token
    access_token = create_access_token(data={"sub": team.id})
    
    logger.info(f"Team logged in: {team.name} (ID: {team.id})")
    
    return TokenResponse(
        access_token=access_token,
        team_id=team.id,
        team_name=team.name,
        team_color=team.color,
        is_admin=team.is_admin,
        game_session_id=team.game_session_id
    )
