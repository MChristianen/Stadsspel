from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict

from app.db.session import get_db
from app.db.models import GameSession, Area, Submission, SubmissionStatus, Team
from app.services.media_url import resolve_public_media_url

router = APIRouter(prefix="/results", tags=["results"])

class SubmissionMediaGalleryItem(BaseModel):
    id: int
    team_id: int
    team_name: str
    area_id: int
    area_name: str
    text: str
    created_at: str
    media: List[Dict]

class AreaMediaGallery(BaseModel):
    area_id: int
    area_name: str
    submissions: List[SubmissionMediaGalleryItem]

@router.get("/{join_code}/media", response_model=List[AreaMediaGallery])
def get_public_media_gallery(join_code: str, request: Request, db: Session = Depends(get_db)):
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

    # Get all areas for the city
    areas = db.query(Area).filter(Area.city_id == session.city_id).all()
    area_map = {a.id: a for a in areas}

    # Get all approved submissions for this session
    submissions = db.query(Submission).filter(
        Submission.game_session_id == session.id,
        Submission.status == SubmissionStatus.APPROVED
    ).order_by(Submission.created_at.asc()).all()

    # Get teams
    teams = {t.id: t for t in db.query(Team).filter(Team.game_session_id == session.id).all()}

    # Group submissions by area
    area_galleries = {}
    for sub in submissions:
        area = area_map.get(sub.area_id)
        if not area:
            continue
        team = teams.get(sub.team_id)
        item = SubmissionMediaGalleryItem(
            id=sub.id,
            team_id=sub.team_id,
            team_name=team.name if team else "?",
            area_id=sub.area_id,
            area_name=area.name,
            text=sub.text,
            created_at=sub.created_at.isoformat(),
            media=[
                {"id": m.id, "media_type": m.media_type.value, "url": resolve_public_media_url(request, m.url)}
                for m in sub.media
            ]
        )
        if area.id not in area_galleries:
            area_galleries[area.id] = AreaMediaGallery(
                area_id=area.id,
                area_name=area.name,
                submissions=[]
            )
        area_galleries[area.id].submissions.append(item)

    return list(area_galleries.values())
