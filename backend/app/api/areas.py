"""Areas and challenges endpoints."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping

from app.db.session import get_db
from app.db.models import Area, Challenge, Team, GameSession
from app.core.security import get_current_team
from app.services.ownership import get_area_ownership

router = APIRouter(prefix="/areas", tags=["areas"])


# Schemas
class ChallengeInfo(BaseModel):
    id: int
    mode: str
    title: str
    description: str
    time_limit_minutes: int | None


class OwnershipInfo(BaseModel):
    owner_team_id: int | None
    owner_team_name: str | None
    owner_team_color: str | None
    current_high_score: float | None
    captured_at: datetime | None
    owned_seconds: int | None


class AreaResponse(BaseModel):
    id: int
    name: str
    description: str | None
    geometry: dict  # GeoJSON
    center: dict  # GeoJSON Point
    challenge: ChallengeInfo
    ownership: OwnershipInfo | None


class AreasGeoJSON(BaseModel):
    type: str = "FeatureCollection"
    features: list[dict[str, Any]]


@router.get("/geojson", response_model=AreasGeoJSON)
def get_areas_geojson(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """
    Get all areas as GeoJSON FeatureCollection with ownership info.
    Used by map for rendering polygons.
    """
    if team.is_admin:
        # Admin should also be able to view map areas for a newly created (not yet active) session.
        session = db.query(GameSession).filter(GameSession.is_active == True).first()
        if not session:
            session = db.query(GameSession).order_by(GameSession.created_at.desc()).first()
    else:
        if not team.game_session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not part of any game session"
            )
        session = db.query(GameSession).filter(GameSession.id == team.game_session_id).first()

    if not session:
        if team.is_admin:
            return AreasGeoJSON(features=[])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session available"
        )

    areas = db.query(Area).filter(Area.city_id == session.city_id).all()
    include_live_ownership = session.is_active
    
    features = []
    for area in areas:
        # Convert PostGIS geometry to GeoJSON
        polygon_shape = to_shape(area.geom)
        polygon_geojson = mapping(polygon_shape)
        
        center_shape = to_shape(area.center_point)
        center_geojson = mapping(center_shape)
        
        # Get ownership
        ownership = get_area_ownership(db, area.id) if include_live_ownership else None
        owner_team = None
        if ownership and ownership.owner_team_id:
            owner_team = db.query(Team).filter(Team.id == ownership.owner_team_id).first()
        
        # Get challenge
        challenge = db.query(Challenge).filter(Challenge.area_id == area.id).first()
        
        feature = {
            "type": "Feature",
            "geometry": polygon_geojson,
            "properties": {
                "id": area.id,
                "name": area.name,
                "description": area.description,
                "center": center_geojson,
                "challenge": {
                    "id": challenge.id,
                    "mode": challenge.mode.value,
                    "title": challenge.title
                } if challenge else None,
                "ownership": {
                    "owner_team_id": ownership.owner_team_id if ownership else None,
                    "owner_team_name": owner_team.name if owner_team else None,
                    "owner_team_color": owner_team.color if owner_team else None,
                    "current_high_score": ownership.current_high_score if ownership else None,
                    "captured_at": ownership.captured_at if ownership else None,
                    "owned_seconds": int(
                        max(
                            0,
                            (
                                (
                                    min(datetime.utcnow(), session.end_time)
                                    if session.end_time
                                    else datetime.utcnow()
                                ) - ownership.captured_at
                            ).total_seconds()
                        )
                    ) if ownership and ownership.owner_team_id and ownership.captured_at else None,
                }
            }
        }
        features.append(feature)
    
    return AreasGeoJSON(features=features)


@router.get("/{area_id}", response_model=AreaResponse)
def get_area_detail(
    area_id: int,
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """Get detailed information about a specific area."""
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area not found"
        )
    
    # Get challenge
    challenge = db.query(Challenge).filter(Challenge.area_id == area_id).first()
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No challenge found for this area"
        )
    
    # Get ownership
    ownership = get_area_ownership(db, area_id)
    owner_team = None
    if ownership and ownership.owner_team_id:
        owner_team = db.query(Team).filter(Team.id == ownership.owner_team_id).first()
    
    # Convert geometries
    polygon_shape = to_shape(area.geom)
    polygon_geojson = mapping(polygon_shape)
    
    center_shape = to_shape(area.center_point)
    center_geojson = mapping(center_shape)
    
    return AreaResponse(
        id=area.id,
        name=area.name,
        description=area.description,
        geometry=polygon_geojson,
        center=center_geojson,
        challenge=ChallengeInfo(
            id=challenge.id,
            mode=challenge.mode.value,
            title=challenge.title,
            description=challenge.description,
            time_limit_minutes=challenge.time_limit_minutes
        ),
        ownership=OwnershipInfo(
            owner_team_id=ownership.owner_team_id if ownership else None,
            owner_team_name=owner_team.name if owner_team else None,
            owner_team_color=owner_team.color if owner_team else None,
            current_high_score=ownership.current_high_score if ownership else None,
            captured_at=ownership.captured_at if ownership else None,
            owned_seconds=None
        ) if ownership else None
    )
