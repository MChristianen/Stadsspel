"""Service for managing territory ownership and points."""
from datetime import datetime
from math import floor
from sqlalchemy.orm import Session

from app.db.models import (
    Area,
    AreaTeamPoints,
    Challenge,
    ChallengeMode,
    GameSession,
    Submission,
    TerritoryOwnership,
    Team,
)


def _effective_capture_points(area: Area) -> float:
    if area.capture_points is not None:
        return float(area.capture_points)
    return float(area.city.default_capture_points)


def _effective_hold_rate(area: Area) -> float:
    if area.hold_points_per_minute is not None:
        return float(area.hold_points_per_minute)
    return float(area.city.default_hold_points_per_minute)


def _effective_time_for_session(session: GameSession, now: datetime) -> datetime:
    if session.end_time and now > session.end_time:
        return session.end_time
    return now


def _full_minutes_between(start: datetime, end: datetime) -> int:
    if end <= start:
        return 0
    return floor((end - start).total_seconds() / 60)


def _get_or_create_points_row(
    db: Session,
    game_session_id: int,
    area_id: int,
    team_id: int,
) -> AreaTeamPoints:
    row = (
        db.query(AreaTeamPoints)
        .filter(
            AreaTeamPoints.game_session_id == game_session_id,
            AreaTeamPoints.area_id == area_id,
            AreaTeamPoints.team_id == team_id,
        )
        .with_for_update()
        .first()
    )
    if row:
        return row

    row = AreaTeamPoints(
        game_session_id=game_session_id,
        area_id=area_id,
        team_id=team_id,
        capture_points=0.0,
        accrued_hold_points=0.0,
    )
    db.add(row)
    db.flush()
    return row


def update_ownership(
    db: Session,
    area_id: int,
    approved_submission: Submission,
) -> TerritoryOwnership:
    """
    Update territory ownership after approved submission and apply points logic.

    Rules:
    - Ownership decision still depends on challenge mode.
    - Capture points are awarded only when ownership actually changes.
    - Hold points are banked on ownership change using full elapsed minutes.
    - Hold points stop at session end_time.
    """
    ownership = (
        db.query(TerritoryOwnership)
        .filter(TerritoryOwnership.area_id == area_id)
        .with_for_update()
        .first()
    )
    if not ownership:
        ownership = TerritoryOwnership(area_id=area_id)
        db.add(ownership)
        db.flush()

    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise ValueError(f"Area not found: {area_id}")
    if not area.city:
        raise ValueError(f"Area {area_id} has no city relation")

    challenge = db.query(Challenge).filter(Challenge.area_id == area_id).first()
    if not challenge:
        raise ValueError(f"No challenge found for area {area_id}")

    session = db.query(GameSession).filter(GameSession.id == approved_submission.game_session_id).first()
    if not session:
        raise ValueError("Submission is not linked to a valid game session")

    previous_owner_id = ownership.owner_team_id
    new_owner_id = previous_owner_id

    if challenge.mode == ChallengeMode.LAST_APPROVED_WINS:
        new_owner_id = approved_submission.team_id
        ownership.current_high_score = approved_submission.score
    elif challenge.mode == ChallengeMode.HIGHEST_SCORE_WINS:
        if approved_submission.score is None:
            raise ValueError("Score required for HIGHEST_SCORE_WINS mode")
        if ownership.current_high_score is None or approved_submission.score > ownership.current_high_score:
            new_owner_id = approved_submission.team_id
            ownership.current_high_score = approved_submission.score

    now = datetime.utcnow()
    effective_now = _effective_time_for_session(session, now)
    ownership_changed = new_owner_id != previous_owner_id

    if ownership_changed:
        # Bank hold points for previous owner up to transfer moment.
        if previous_owner_id and ownership.captured_at:
            minutes_held = _full_minutes_between(ownership.captured_at, effective_now)
            if minutes_held > 0:
                previous_row = _get_or_create_points_row(
                    db=db,
                    game_session_id=session.id,
                    area_id=area_id,
                    team_id=previous_owner_id,
                )
                previous_row.accrued_hold_points += minutes_held * _effective_hold_rate(area)

        ownership.owner_team_id = new_owner_id
        ownership.captured_at = effective_now if new_owner_id else None

        # Award capture points only on real owner change.
        if new_owner_id:
            new_row = _get_or_create_points_row(
                db=db,
                game_session_id=session.id,
                area_id=area_id,
                team_id=new_owner_id,
            )
            new_row.capture_points += _effective_capture_points(area)

    ownership.last_approved_submission_id = approved_submission.id
    ownership.updated_at = now

    db.commit()
    db.refresh(ownership)
    return ownership


def get_area_ownership(db: Session, area_id: int) -> TerritoryOwnership | None:
    """Get current ownership for an area."""
    return db.query(TerritoryOwnership).filter(TerritoryOwnership.area_id == area_id).first()


def compute_team_scores(
    db: Session,
    session: GameSession,
) -> list[dict]:
    """
    Compute live score per team in session.

    Returned dict rows:
    - team_id
    - points
    - territory_count
    """
    teams = (
        db.query(Team)
        .filter(
            Team.game_session_id == session.id,
            Team.is_admin == False,
        )
        .all()
    )
    if not teams:
        return []

    team_ids = [team.id for team in teams]
    result = {
        team_id: {"team_id": team_id, "points": 0.0, "territory_count": 0}
        for team_id in team_ids
    }

    points_rows = (
        db.query(AreaTeamPoints)
        .filter(
            AreaTeamPoints.game_session_id == session.id,
            AreaTeamPoints.team_id.in_(team_ids),
        )
        .all()
    )
    for row in points_rows:
        result[row.team_id]["points"] += float(row.capture_points or 0.0) + float(row.accrued_hold_points or 0.0)

    effective_now = _effective_time_for_session(session, datetime.utcnow())
    area_ids = [row[0] for row in db.query(Area.id).filter(Area.city_id == session.city_id).all()]
    if area_ids:
        live_ownership = (
            db.query(TerritoryOwnership)
            .filter(
                TerritoryOwnership.area_id.in_(area_ids),
                TerritoryOwnership.owner_team_id.in_(team_ids),
            )
            .all()
        )
        areas_by_id = {area.id: area for area in db.query(Area).filter(Area.id.in_(area_ids)).all()}
        for ownership in live_ownership:
            owner_id = ownership.owner_team_id
            if owner_id is None or ownership.captured_at is None:
                continue
            result[owner_id]["territory_count"] += 1
            area = areas_by_id.get(ownership.area_id)
            if not area:
                continue
            held_minutes = _full_minutes_between(ownership.captured_at, effective_now)
            if held_minutes > 0:
                result[owner_id]["points"] += held_minutes * _effective_hold_rate(area)

    return list(result.values())
