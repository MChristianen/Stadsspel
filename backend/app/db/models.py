from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, Float,
    ForeignKey, Enum, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.base import Base


class ChallengeMode(str, PyEnum):
    """Challenge win mode."""
    LAST_APPROVED_WINS = "LAST_APPROVED_WINS"
    HIGHEST_SCORE_WINS = "HIGHEST_SCORE_WINS"


class SubmissionStatus(str, PyEnum):
    """Submission approval status."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class MediaType(str, PyEnum):
    """Media file type."""
    PHOTO = "PHOTO"
    VIDEO = "VIDEO"


class GameSession(Base):
    """Game session - represents a configured game with city, teams, and settings."""
    __tablename__ = "game_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    join_code = Column(String(20), unique=True, nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False, index=True)  # Game started?
    is_finished = Column(Boolean, default=False, nullable=False)
    started_at = Column(DateTime, nullable=True)  # When game was started
    end_time = Column(DateTime, nullable=True)  # Calculated: started_at + duration
    published_at = Column(DateTime, nullable=True)  # When results were published
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    city = relationship("City", back_populates="game_sessions")
    teams = relationship("Team", back_populates="game_session")
    submissions = relationship("Submission", back_populates="game_session")


class City(Base):
    """City/location for the game."""
    __tablename__ = "cities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    default_capture_points = Column(Float, nullable=False, default=60.0)
    default_hold_points_per_minute = Column(Float, nullable=False, default=0.6)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    areas = relationship("Area", back_populates="city")
    game_sessions = relationship("GameSession", back_populates="city")


class Area(Base):
    """Geographic area/polygon on the map."""
    __tablename__ = "areas"
    
    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    capture_points = Column(Float, nullable=True)  # Null -> use city default
    hold_points_per_minute = Column(Float, nullable=True)  # Null -> use city default
    
    # PostGIS geometry columns
    geom = Column(Geometry("POLYGON", srid=4326), nullable=False)
    center_point = Column(Geometry("POINT", srid=4326), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    city = relationship("City", back_populates="areas")
    challenge = relationship("Challenge", back_populates="area", uselist=False)
    submissions = relationship("Submission", back_populates="area")
    ownership = relationship("TerritoryOwnership", back_populates="area", uselist=False)
    
    __table_args__ = (
        Index("idx_areas_geom", "geom", postgresql_using="gist"),
        Index("idx_areas_center", "center_point", postgresql_using="gist"),
    )


class Challenge(Base):
    """Challenge/task for an area - exactly one per area."""
    __tablename__ = "challenges"
    
    id = Column(Integer, primary_key=True, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"), unique=True, nullable=False)
    mode = Column(Enum(ChallengeMode), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    time_limit_minutes = Column(Integer, nullable=True)  # Optional per-challenge time limit
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    area = relationship("Area", back_populates="challenge")


class Team(Base):
    """Team account - for both regular teams and admins."""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, index=True)
    game_session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=True, index=True)  # Null for admin teams
    name = Column(String(100), nullable=False, index=True)  # No longer unique globally
    photo_url = Column(String(500), nullable=True)
    password_hash = Column(String(255), nullable=False)
    color = Column(String(7), nullable=False)  # Hex color e.g. #FF5733
    is_admin = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    game_session = relationship("GameSession", back_populates="teams")
    submissions = relationship("Submission", back_populates="team", foreign_keys="Submission.team_id")
    owned_territories = relationship("TerritoryOwnership", back_populates="owner_team")
    approvals = relationship("Approval", back_populates="admin_team")
    
    __table_args__ = (
        # Only enforce unique name per session for non-admin teams
        Index("idx_team_name_per_session", "game_session_id", "name", 
              unique=True, postgresql_where=Column("is_admin") == False),
    )


class Submission(Base):
    """Team submission for a challenge."""
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    game_session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False, index=True)
    
    text = Column(Text, nullable=False)
    score = Column(Float, nullable=True)  # For HIGHEST_SCORE_WINS mode
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.PENDING, nullable=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    game_session = relationship("GameSession", back_populates="submissions")
    team = relationship("Team", back_populates="submissions", foreign_keys=[team_id])
    area = relationship("Area", back_populates="submissions")
    media = relationship("SubmissionMedia", back_populates="submission", cascade="all, delete-orphan")
    approval = relationship("Approval", back_populates="submission", uselist=False)
    
    __table_args__ = (
        Index("idx_submissions_team_area", "team_id", "area_id"),
        Index("idx_submissions_status_created", "status", "created_at"),
    )


class SubmissionMedia(Base):
    """Media files attached to submissions."""
    __tablename__ = "submission_media"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    media_type = Column(Enum(MediaType), nullable=False)
    url = Column(String(1000), nullable=False)  # Full URL or path
    file_size = Column(Integer, nullable=True)  # Bytes
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    submission = relationship("Submission", back_populates="media")


class Approval(Base):
    """Admin approval/rejection of submission with optional message."""
    __tablename__ = "approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), unique=True, nullable=False, index=True)
    admin_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    decision = Column(Enum(SubmissionStatus), nullable=False)  # APPROVED or REJECTED
    message = Column(Text, nullable=True)  # Optional feedback to team
    decided_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    submission = relationship("Submission", back_populates="approval")
    admin_team = relationship("Team", back_populates="approvals")
    
    __table_args__ = (
        CheckConstraint(
            "decision IN ('APPROVED', 'REJECTED')", 
            name="check_approval_decision"
        ),
    )


class TerritoryOwnership(Base):
    """Current ownership status of each area - materialized for performance."""
    __tablename__ = "territory_ownership"
    
    id = Column(Integer, primary_key=True, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"), unique=True, nullable=False, index=True)
    owner_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True, index=True)
    captured_at = Column(DateTime, nullable=True)  # Timestamp of last ownership change
    current_high_score = Column(Float, nullable=True)  # For HIGHEST_SCORE_WINS mode
    last_approved_submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    area = relationship("Area", back_populates="ownership")
    owner_team = relationship("Team", back_populates="owned_territories")


class AreaTeamPoints(Base):
    """Accumulated points by team per area within a session."""
    __tablename__ = "area_team_points"

    id = Column(Integer, primary_key=True, index=True)
    game_session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    capture_points = Column(Float, nullable=False, default=0.0)
    accrued_hold_points = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("game_session_id", "area_id", "team_id", name="uq_area_team_points_session_area_team"),
    )
