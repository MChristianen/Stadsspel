"""Service for managing submission cooldown periods."""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models import Submission, SubmissionStatus
from app.core.config import settings


def check_cooldown(db: Session, team_id: int, area_id: int) -> tuple[bool, datetime | None]:
    """
    Check if a team is in cooldown for a specific area.
    
    Returns:
        (can_submit, last_submission_time)
        - can_submit: True if team can submit
        - last_submission_time: Time of last submission, or None
    """
    cooldown_delta = timedelta(minutes=settings.DEFAULT_COOLDOWN_MINUTES)
    cutoff_time = datetime.utcnow() - cooldown_delta
    
    # Find most recent submission by this team for this area
    last_submission = db.query(Submission).filter(
        and_(
            Submission.team_id == team_id,
            Submission.area_id == area_id
        )
    ).order_by(Submission.created_at.desc()).first()
    
    if not last_submission:
        return True, None
    
    # Check if last submission is within cooldown period
    if last_submission.created_at > cutoff_time:
        return False, last_submission.created_at
    
    return True, last_submission.created_at


def get_remaining_cooldown_seconds(last_submission_time: datetime) -> int:
    """Calculate remaining cooldown seconds."""
    cooldown_delta = timedelta(minutes=settings.DEFAULT_COOLDOWN_MINUTES)
    elapsed = datetime.utcnow() - last_submission_time
    remaining = cooldown_delta - elapsed
    
    if remaining.total_seconds() <= 0:
        return 0
    
    return int(remaining.total_seconds())
