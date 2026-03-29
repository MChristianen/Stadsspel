"""Submissions endpoints."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.db.models import (
    Submission, SubmissionMedia, Team, Challenge, GameSession,
    SubmissionStatus, MediaType, ChallengeMode
)
from app.core.security import get_current_team
from app.services.cooldown import check_cooldown, get_remaining_cooldown_seconds
from app.services.storage import storage_service
from app.services.media_url import resolve_public_media_url
from app.core.logging import logger

router = APIRouter(prefix="/submissions", tags=["submissions"])

MAX_PHOTO_FILES = 5
MAX_VIDEO_FILES = 2
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}


def get_upload_size_bytes(file: UploadFile) -> int:
    """Get upload size without consuming the stream."""
    position = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(position)
    return size


def validate_media_files(files: List[UploadFile], allowed_types: set[str], max_size_bytes: int, label: str):
    for upload in files:
        if not upload.filename:
            continue
        if upload.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid {label} type: {upload.content_type}"
            )
        size = get_upload_size_bytes(upload)
        if size > max_size_bytes:
            max_mb = int(max_size_bytes / (1024 * 1024))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label.capitalize()} file too large (max {max_mb}MB)"
            )


# Schemas
class SubmissionMediaResponse(BaseModel):
    id: int
    media_type: str
    url: str


class SubmissionResponse(BaseModel):
    id: int
    team_id: int
    team_name: str
    area_id: int
    text: str
    score: float | None
    status: str
    created_at: datetime
    media: List[SubmissionMediaResponse]


class MySubmissionsResponse(BaseModel):
    submissions: List[SubmissionResponse]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_submission(
    area_id: int = Form(...),
    text: str = Form(default=""),
    score: float | None = Form(None),
    photos: List[UploadFile] = File(default=[]),
    videos: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """
    Submit a challenge attempt for an area.
    Requires: At least one of text, photos, or videos.
    """
    # Validate that at least one content type is provided
    has_text = text and text.strip()
    has_photos = photos and any(p.filename for p in photos)
    has_videos = videos and any(v.filename for v in videos)
    
    if not (has_text or has_photos or has_videos):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Je moet minimaal tekst, een foto of een video uploaden"
        )

    valid_photo_files = [p for p in photos if p.filename]
    valid_video_files = [v for v in videos if v.filename]

    if len(valid_photo_files) > MAX_PHOTO_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many photos (max {MAX_PHOTO_FILES})"
        )
    if len(valid_video_files) > MAX_VIDEO_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many videos (max {MAX_VIDEO_FILES})"
        )

    validate_media_files(valid_photo_files, ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE_BYTES, "photo")
    validate_media_files(valid_video_files, ALLOWED_VIDEO_TYPES, MAX_VIDEO_SIZE_BYTES, "video")
    
    # Check if team has a game session
    if not team.game_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not part of any game session"
        )
    
    # Check if game session is active
    from app.db.models import GameSession, Area
    session = db.query(GameSession).filter(GameSession.id == team.game_session_id).first()
    if not session or not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active game"
        )
    
    # Validate that area belongs to the team's session city
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area not found"
        )
    
    if area.city_id != session.city_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This area does not belong to your game session's city"
        )
    
    now = datetime.utcnow()
    if now >= session.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game has ended, submissions are closed"
        )
    
    # Check cooldown
    can_submit, last_submission_time = check_cooldown(db, team.id, area_id)
    if not can_submit:
        remaining = get_remaining_cooldown_seconds(last_submission_time)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Cooldown active. Try again in {remaining} seconds."
        )
    
    # Validate challenge mode
    challenge = db.query(Challenge).filter(Challenge.area_id == area_id).first()
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No challenge for this area"
        )
    
    if challenge.mode == ChallengeMode.HIGHEST_SCORE_WINS:
        if score is None or score < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Score is verplicht voor deze opdracht (minimaal 0)"
            )
    
    # Create submission
    submission = Submission(
        game_session_id=team.game_session_id,
        team_id=team.id,
        area_id=area_id,
        text=text,
        score=score,
        status=SubmissionStatus.PENDING
    )
    
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    # Upload media files
    media_items = []
    
    for photo in photos:
        if photo.filename:
            url = await storage_service.save_file(photo, subfolder="submissions")
            media = SubmissionMedia(
                submission_id=submission.id,
                media_type=MediaType.PHOTO,
                url=url
            )
            db.add(media)
            media_items.append(media)
    
    for video in videos:
        if video.filename:
            url = await storage_service.save_file(video, subfolder="submissions")
            media = SubmissionMedia(
                submission_id=submission.id,
                media_type=MediaType.VIDEO,
                url=url
            )
            db.add(media)
            media_items.append(media)
    
    db.commit()
    
    logger.info(f"Submission created: ID {submission.id} by team {team.name} for area {area_id}")
    
    return {
        "message": "Submission created successfully",
        "submission_id": submission.id,
        "status": submission.status.value,
        "media_count": len(media_items)
    }


@router.get("/my", response_model=MySubmissionsResponse)
def get_my_submissions(
    request: Request,
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """Get all submissions by the current team."""
    submissions = db.query(Submission).filter(
        Submission.team_id == team.id
    ).order_by(Submission.created_at.desc()).all()
    
    result = []
    for sub in submissions:
        media = [
            SubmissionMediaResponse(
                id=m.id,
                media_type=m.media_type.value,
                url=resolve_public_media_url(request, m.url)
            )
            for m in sub.media
        ]
        
        result.append(SubmissionResponse(
            id=sub.id,
            team_id=sub.team_id,
            team_name=team.name,
            area_id=sub.area_id,
            text=sub.text,
            score=sub.score,
            status=sub.status.value,
            created_at=sub.created_at,
            media=media
        ))
    
    return MySubmissionsResponse(submissions=result)


@router.get("/area/{area_id}")
def get_submissions_for_area(
    area_id: int,
    request: Request,
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """
    Get submissions for a specific area.
    Teams can only see their own submissions unless game results are published.
    """
    if team.game_session_id:
        session = db.query(GameSession).filter(GameSession.id == team.game_session_id).first()
    else:
        session = db.query(GameSession).filter(GameSession.is_active == True).first()

    if not session:
        return {"submissions": []}

    # Show all session submissions only after results are published.
    if session.published_at:
        submissions = db.query(Submission).filter(
            and_(
                Submission.area_id == area_id,
                Submission.game_session_id == session.id
            )
        ).order_by(Submission.created_at.desc()).all()
    else:
        # Otherwise only own submissions.
        submissions = db.query(Submission).filter(
            and_(
                Submission.area_id == area_id,
                Submission.team_id == team.id,
                Submission.game_session_id == session.id
            )
        ).order_by(Submission.created_at.desc()).all()
    
    result = []
    for sub in submissions:
        sub_team = db.query(Team).filter(Team.id == sub.team_id).first()
        media = [
            SubmissionMediaResponse(
                id=m.id,
                media_type=m.media_type.value,
                url=resolve_public_media_url(request, m.url)
            )
            for m in sub.media
        ]
        
        result.append(SubmissionResponse(
            id=sub.id,
            team_id=sub.team_id,
            team_name=sub_team.name if sub_team else "Unknown",
            area_id=sub.area_id,
            text=sub.text,
            score=sub.score,
            status=sub.status.value,
            created_at=sub.created_at,
            media=media
        ))
    
    return {"submissions": result}


class AreaCooldownResponse(BaseModel):
    area_id: int
    can_submit: bool
    remaining_seconds: int


@router.get("/cooldowns", response_model=List[AreaCooldownResponse])
def get_my_cooldowns(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """Get cooldown status for all areas for current team."""
    from app.db.models import Area
    
    if not team.game_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not part of any game session"
        )
    
    # Get session to find city_id
    from app.db.models import GameSession
    session = db.query(GameSession).filter(GameSession.id == team.game_session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game session not found"
        )
    
    # Get all areas in the city
    areas = db.query(Area).filter(Area.city_id == session.city_id).all()
    
    result = []
    for area in areas:
        can_submit, last_submission_time = check_cooldown(db, team.id, area.id)
        remaining_seconds = 0
        if not can_submit and last_submission_time:
            remaining_seconds = get_remaining_cooldown_seconds(last_submission_time)
        
        result.append(AreaCooldownResponse(
            area_id=area.id,
            can_submit=can_submit,
            remaining_seconds=remaining_seconds
        ))
    
    return result
