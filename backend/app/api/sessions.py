"""Game session management endpoints."""
import secrets
import string
from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List

from app.db.session import get_db
from app.db.models import GameSession, City, Team, Area, TerritoryOwnership, AreaTeamPoints
from app.core.security import get_current_admin, get_password_hash
from app.core.logging import logger
from app.services.auto_export import auto_export_exists, ensure_auto_export_for_session, get_auto_export_path
from app.services.export_zip import create_export_zip

router = APIRouter(prefix="/sessions", tags=["sessions"])


# Schemas
class CreateSessionRequest(BaseModel):
    city_id: int
    duration_minutes: int


class TeamInfo(BaseModel):
    id: int
    name: str
    color: str
    created_at: datetime


class SessionResponse(BaseModel):
    id: int
    city_id: int
    city_name: str
    join_code: str
    duration_minutes: int
    is_active: bool
    is_finished: bool
    started_at: datetime | None
    end_time: datetime | None
    team_count: int
    join_url: str
    results_url: str
    auto_export_ready: bool = False
    teams: List[TeamInfo] = []


class SessionDetailResponse(SessionResponse):
    teams: List[TeamInfo]


class CityInfo(BaseModel):
    id: int
    name: str
    description: str | None
    area_count: int


class AreaPointsConfig(BaseModel):
    area_id: int
    name: str
    capture_points: float | None
    hold_points_per_minute: float | None
    effective_capture_points: float
    effective_hold_points_per_minute: float


class CityPointsConfigResponse(BaseModel):
    city_id: int
    city_name: str
    default_capture_points: float
    default_hold_points_per_minute: float
    areas: List[AreaPointsConfig]


class AreaPointsConfigUpdate(BaseModel):
    area_id: int
    capture_points: float | None = Field(default=None, ge=0)
    hold_points_per_minute: float | None = Field(default=None, ge=0)


class UpdateCityPointsConfigRequest(BaseModel):
    default_capture_points: float = Field(..., ge=0)
    default_hold_points_per_minute: float = Field(..., ge=0)
    areas: List[AreaPointsConfigUpdate] = Field(default_factory=list)


class JoinRequest(BaseModel):
    team_name: str
    password: str
    color: str


class JoinResponse(BaseModel):
    team_id: int
    team_name: str
    auth_token: str
    session_id: int
    city_name: str


class StartSessionRequest(BaseModel):
    additional_admin_team_ids: List[int] = Field(default_factory=list)


class CreatedAdminAccount(BaseModel):
    team_id: int
    team_name: str
    admin_username: str
    admin_password: str


def generate_join_code(length: int = 6) -> str:
    """Generate a random join code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def _build_city_points_config(city: City, areas: List[Area]) -> CityPointsConfigResponse:
    return CityPointsConfigResponse(
        city_id=city.id,
        city_name=city.name,
        default_capture_points=float(city.default_capture_points),
        default_hold_points_per_minute=float(city.default_hold_points_per_minute),
        areas=[
            AreaPointsConfig(
                area_id=area.id,
                name=area.name,
                capture_points=float(area.capture_points) if area.capture_points is not None else None,
                hold_points_per_minute=float(area.hold_points_per_minute) if area.hold_points_per_minute is not None else None,
                effective_capture_points=float(area.capture_points if area.capture_points is not None else city.default_capture_points),
                effective_hold_points_per_minute=float(
                    area.hold_points_per_minute
                    if area.hold_points_per_minute is not None
                    else city.default_hold_points_per_minute
                ),
            )
            for area in sorted(areas, key=lambda a: a.name.lower())
        ],
    )


@router.get("/cities", response_model=List[CityInfo])
def list_cities(
    db: Session = Depends(get_db)
):
    """Get all available cities for game creation."""
    cities = db.query(City).all()
    
    result = []
    for city in cities:
        area_count = db.query(Area).filter(Area.city_id == city.id).count()
        result.append(CityInfo(
            id=city.id,
            name=city.name,
            description=city.description,
            area_count=area_count
        ))
    
    return result


@router.get("/cities/{city_id}/points-config", response_model=CityPointsConfigResponse)
def get_city_points_config(
    city_id: int,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin),
):
    """Get point settings for a city and its areas."""
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    areas = db.query(Area).filter(Area.city_id == city.id).all()
    return _build_city_points_config(city, areas)


@router.put("/cities/{city_id}/points-config", response_model=CityPointsConfigResponse)
def update_city_points_config(
    city_id: int,
    data: UpdateCityPointsConfigRequest,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin),
):
    """Update point settings for a city and optional area overrides."""
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    city.default_capture_points = data.default_capture_points
    city.default_hold_points_per_minute = data.default_hold_points_per_minute

    areas = db.query(Area).filter(Area.city_id == city.id).all()
    areas_by_id = {area.id: area for area in areas}

    for area_update in data.areas:
        area = areas_by_id.get(area_update.area_id)
        if not area:
            raise HTTPException(
                status_code=400,
                detail=f"Area {area_update.area_id} does not belong to city {city.name}"
            )
        area.capture_points = area_update.capture_points
        area.hold_points_per_minute = area_update.hold_points_per_minute

    db.commit()
    db.refresh(city)
    areas = db.query(Area).filter(Area.city_id == city.id).all()
    return _build_city_points_config(city, areas)


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    data: CreateSessionRequest,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Create a new game session."""
    # Verify city exists
    city = db.query(City).filter(City.id == data.city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    
    # Verify city has areas
    area_count = db.query(Area).filter(Area.city_id == data.city_id).count()
    if area_count == 0:
        raise HTTPException(status_code=400, detail="City has no areas configured")
    
    # Generate unique join code
    while True:
        join_code = generate_join_code()
        existing = db.query(GameSession).filter(GameSession.join_code == join_code).first()
        if not existing:
            break
    
    # Create session
    session = GameSession(
        city_id=data.city_id,
        join_code=join_code,
        duration_minutes=data.duration_minutes,
        is_active=False,
        is_finished=False
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    logger.info(f"Created game session {session.id} with join code {join_code}")
    
    return SessionResponse(
        id=session.id,
        city_id=session.city_id,
        city_name=city.name,
        join_code=session.join_code,
        duration_minutes=session.duration_minutes,
        is_active=session.is_active,
        is_finished=session.is_finished,
        started_at=session.started_at,
        end_time=session.end_time,
        team_count=0,
        join_url=f"/join/{join_code}",
        results_url=f"/results/{join_code}",
        auto_export_ready=False,
    )


@router.get("", response_model=List[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Get all game sessions."""
    sessions = db.query(GameSession).order_by(GameSession.created_at.desc()).all()
    
    now = datetime.utcnow()
    result = []
    for session in sessions:
        city = db.query(City).filter(City.id == session.city_id).first()
        
        # Get teams for this session
        teams = db.query(Team).filter(
            Team.game_session_id == session.id,
            Team.is_admin == False
        ).all()
        
        team_count = len(teams)
        team_infos = [
            TeamInfo(
                id=t.id,
                name=t.name,
                color=t.color,
                created_at=t.created_at
            )
            for t in teams
        ]
        
        # Calculate is_finished dynamically based on end_time
        is_finished = session.end_time is not None and now >= session.end_time
        
        # Update database if session should be finished but isn't marked as such
        if is_finished and not session.is_finished:
            session.is_finished = True
            session.is_active = False
            db.commit()
            ensure_auto_export_for_session(db, session.id)
        elif is_finished:
            # Ensure auto export also exists for already finished sessions.
            ensure_auto_export_for_session(db, session.id)
        
        result.append(SessionResponse(
            id=session.id,
            city_id=session.city_id,
            city_name=city.name if city else "Unknown",
            join_code=session.join_code,
            duration_minutes=session.duration_minutes,
            is_active=session.is_active,
            is_finished=is_finished,
            started_at=session.started_at,
            end_time=session.end_time,
            team_count=team_count,
            teams=team_infos,
            join_url=f"/join/{session.join_code}",
            results_url=f"/results/{session.join_code}",
            auto_export_ready=auto_export_exists(session.id) if is_finished else False,
        ))
    
    return result


@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Get detailed info about a specific session."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    city = db.query(City).filter(City.id == session.city_id).first()
    teams = db.query(Team).filter(
        Team.game_session_id == session.id,
        Team.is_admin == False
    ).all()
    
    team_infos = [
        TeamInfo(
            id=t.id,
            name=t.name,
            color=t.color,
            created_at=t.created_at
        )
        for t in teams
    ]
    
    return SessionDetailResponse(
        id=session.id,
        city_id=session.city_id,
        city_name=city.name if city else "Unknown",
        join_code=session.join_code,
        duration_minutes=session.duration_minutes,
        is_active=session.is_active,
        is_finished=session.is_finished,
        started_at=session.started_at,
        end_time=session.end_time,
        team_count=len(teams),
        join_url=f"/join/{session.join_code}",
        results_url=f"/results/{session.join_code}",
        auto_export_ready=auto_export_exists(session.id) if session.is_finished else False,
        teams=team_infos
    )


@router.post("/{session_id}/start")
def start_session(
    session_id: int,
    data: StartSessionRequest = Body(default_factory=StartSessionRequest),
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Start a game session."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.is_active:
        raise HTTPException(status_code=400, detail="Session already started")
    
    # Check if there are any teams
    teams = db.query(Team).filter(
        Team.game_session_id == session.id,
        Team.is_admin == False
    ).all()
    team_count = len(teams)
    if team_count == 0:
        raise HTTPException(status_code=400, detail="Cannot start session with no teams")

    # Create optional additional admin accounts for selected teams.
    created_admin_accounts: List[CreatedAdminAccount] = []
    selected_ids = set(data.additional_admin_team_ids or [])
    if selected_ids:
        existing_names = {row[0] for row in db.query(Team.name).all()}
        teams_by_id = {t.id: t for t in teams}

        for team_id in selected_ids:
            team_obj = teams_by_id.get(team_id)
            if not team_obj:
                continue

            base_username = f"{team_obj.name}_admin"
            username = base_username
            suffix = 1
            while username in existing_names:
                username = f"{base_username}_{suffix}"
                suffix += 1

            alphabet = string.ascii_letters + string.digits
            generated_password = ''.join(secrets.choice(alphabet) for _ in range(12))

            admin_account = Team(
                game_session_id=session.id,
                name=username,
                password_hash=get_password_hash(generated_password),
                color=team_obj.color,
                is_admin=True
            )
            db.add(admin_account)
            existing_names.add(username)

            created_admin_accounts.append(CreatedAdminAccount(
                team_id=team_obj.id,
                team_name=team_obj.name,
                admin_username=username,
                admin_password=generated_password
            ))
    
    # Start the session
    # Reset territory ownership for this session's city so every game starts clean.
    city_area_ids = [row[0] for row in db.query(Area.id).filter(Area.city_id == session.city_id).all()]
    if city_area_ids:
        ownership_rows = db.query(TerritoryOwnership).filter(TerritoryOwnership.area_id.in_(city_area_ids)).all()
        for ownership in ownership_rows:
            ownership.owner_team_id = None
            ownership.captured_at = None
            ownership.current_high_score = None
            ownership.last_approved_submission_id = None

    # Ensure score state is clean for this session.
    db.query(AreaTeamPoints).filter(AreaTeamPoints.game_session_id == session.id).delete()

    now = datetime.utcnow()
    session.is_active = True
    session.started_at = now
    session.end_time = now + timedelta(minutes=session.duration_minutes)
    
    db.commit()
    
    logger.info(f"Started game session {session.id} with {team_count} teams")
    
    return {
        "message": "Game started",
        "started_at": session.started_at,
        "end_time": session.end_time,
        "team_count": team_count,
        "created_admin_accounts": [account.model_dump() for account in created_admin_accounts]
    }


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Delete a game session (only if not started)."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete active session")
    
    # Delete associated teams
    db.query(Team).filter(Team.game_session_id == session.id).delete()
    
    db.delete(session)
    db.commit()
    
    logger.info(f"Deleted game session {session.id}")
    
    return {"message": "Session deleted"}


# Public endpoints (no auth required)
@router.get("/public/{join_code}", response_model=SessionResponse)
def get_session_by_code(
    join_code: str,
    db: Session = Depends(get_db)
):
    """Get session info by join code (public endpoint)."""
    session = db.query(GameSession).filter(GameSession.join_code == join_code.upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    city = db.query(City).filter(City.id == session.city_id).first()
    team_count = db.query(Team).filter(
        Team.game_session_id == session.id,
        Team.is_admin == False
    ).count()
    
    return SessionResponse(
        id=session.id,
        city_id=session.city_id,
        city_name=city.name if city else "Unknown",
        join_code=session.join_code,
        duration_minutes=session.duration_minutes,
        is_active=session.is_active,
        is_finished=session.is_finished,
        started_at=session.started_at,
        end_time=session.end_time,
        team_count=team_count,
        join_url=f"/join/{join_code}",
        results_url=f"/results/{join_code}",
        auto_export_ready=auto_export_exists(session.id) if session.is_finished else False,
    )


@router.get("/{session_id}/teams", response_model=List[TeamInfo])
def get_session_teams(
    session_id: int,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Get list of teams in a session."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    teams = db.query(Team).filter(
        Team.game_session_id == session.id,
        Team.is_admin == False
    ).order_by(Team.created_at).all()
    
    return [
        TeamInfo(
            id=t.id,
            name=t.name,
            color=t.color,
            created_at=t.created_at
        )
        for t in teams
    ]


@router.get("/{session_id}/export")
def export_session_results(
    session_id: int,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin),
):
    """Export results/history for a specific session as ZIP."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.end_time and datetime.utcnow() >= session.end_time and not session.is_finished:
        session.is_finished = True
        session.is_active = False
        db.commit()
        ensure_auto_export_for_session(db, session.id)
    elif session.is_finished:
        ensure_auto_export_for_session(db, session.id)

    zip_buffer = create_export_zip(db, session_id)
    city_name = (session.city.name if session.city else "city").replace(" ", "_").lower()
    filename = f"stadsspel_resultaten_{city_name}_sessie_{session_id}.zip"

    logger.info(f"Admin {admin.name} exported results for session {session_id}")
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{session_id}/export/auto")
def download_auto_export(
    session_id: int,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin),
):
    """Download automatic export for a finished session."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_finished:
        raise HTTPException(status_code=400, detail="Session is not finished yet")

    path = ensure_auto_export_for_session(db, session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Auto export not found")

    return FileResponse(
        str(path),
        media_type="application/zip",
        filename=path.name,
    )
