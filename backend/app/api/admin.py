"""Admin endpoints for managing submissions and exporting data."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.db.models import (
    Submission, SubmissionMedia, Team, Approval,
    SubmissionStatus
)
from app.core.security import get_current_admin
from app.services.ownership import update_ownership
from app.services.export_zip import create_export_zip
from app.services.media_url import resolve_public_media_url
from app.core.logging import logger

router = APIRouter(prefix="/admin", tags=["admin"])


# Schemas
class SubmissionMediaInfo(BaseModel):
    id: int
    media_type: str
    url: str


class PendingSubmissionResponse(BaseModel):
    id: int
    team_id: int
    team_name: str
    area_id: int
    area_name: str
    challenge_title: str
    text: str
    score: float | None
    created_at: datetime
    media: List[SubmissionMediaInfo]


class ApprovalRequest(BaseModel):
    message: str | None = None


@router.get("/submissions/pending")
def get_pending_submissions(
    request: Request,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Get all pending submissions for admin review."""
    from app.db.models import Area, Challenge
    
    pending = db.query(Submission).filter(
        Submission.status == SubmissionStatus.PENDING
    ).order_by(Submission.created_at.asc()).all()
    
    result = []
    for sub in pending:
        team = db.query(Team).filter(Team.id == sub.team_id).first()
        area = db.query(Area).filter(Area.id == sub.area_id).first()
        challenge = db.query(Challenge).filter(Challenge.area_id == sub.area_id).first()
        
        media = [
            SubmissionMediaInfo(
                id=m.id,
                media_type=m.media_type.value,
                url=resolve_public_media_url(request, m.url)
            )
            for m in sub.media
        ]
        
        result.append(PendingSubmissionResponse(
            id=sub.id,
            team_id=sub.team_id,
            team_name=team.name if team else "Unknown",
            area_id=sub.area_id,
            area_name=area.name if area else "Unknown",
            challenge_title=challenge.title if challenge else "Unknown",
            text=sub.text,
            score=sub.score,
            created_at=sub.created_at,
            media=media
        ))
    
    return {"pending_submissions": result, "count": len(result)}


@router.post("/submissions/{submission_id}/approve")
def approve_submission(
    submission_id: int,
    data: ApprovalRequest,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Approve a submission and update territory ownership."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    if submission.status != SubmissionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submission already {submission.status.value}"
        )
    
    # Update submission status
    submission.status = SubmissionStatus.APPROVED
    submission.updated_at = datetime.utcnow()
    
    # Create approval record
    approval = Approval(
        submission_id=submission.id,
        admin_team_id=admin.id,
        decision=SubmissionStatus.APPROVED,
        message=data.message,
        decided_at=datetime.utcnow()
    )
    db.add(approval)
    
    # Update territory ownership (within transaction)
    try:
        ownership = update_ownership(db, submission.area_id, submission)
        logger.info(
            f"Submission {submission_id} approved by admin {admin.name}. "
            f"Area {submission.area_id} now owned by team {ownership.owner_team_id}"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update ownership: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update ownership"
        )
    
    return {
        "message": "Submission approved",
        "submission_id": submission.id,
        "new_owner_team_id": ownership.owner_team_id
    }


@router.post("/submissions/{submission_id}/reject")
def reject_submission(
    submission_id: int,
    data: ApprovalRequest,
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """Reject a submission with optional feedback message."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    if submission.status != SubmissionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submission already {submission.status.value}"
        )
    
    # Update submission status
    submission.status = SubmissionStatus.REJECTED
    submission.updated_at = datetime.utcnow()
    
    # Create approval record
    approval = Approval(
        submission_id=submission.id,
        admin_team_id=admin.id,
        decision=SubmissionStatus.REJECTED,
        message=data.message,
        decided_at=datetime.utcnow()
    )
    db.add(approval)
    db.commit()
    
    logger.info(f"Submission {submission_id} rejected by admin {admin.name}")
    
    return {
        "message": "Submission rejected",
        "submission_id": submission.id
    }


@router.get("/export")
def export_game_data(
    db: Session = Depends(get_db),
    admin: Team = Depends(get_current_admin)
):
    """
    Export all game data as ZIP file.
    Includes metadata, submissions, and references to media.
    """
    from app.db.models import GameSession
    session = db.query(GameSession).filter(GameSession.is_active == True).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active game session found"
        )
    
    # Create ZIP file (using session.id as game_id parameter)
    zip_buffer = create_export_zip(db, session.id)
    
    filename = f"stadsspel_export_{session.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    
    logger.info(f"Admin {admin.name} exported game session {session.id}")
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
