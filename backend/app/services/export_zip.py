"""Service for exporting session results as ZIP file."""
import csv
import io
import json
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from math import floor
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.models import (
    Approval,
    Area,
    Challenge,
    ChallengeMode,
    GameSession,
    Submission,
    SubmissionStatus,
    Team,
)


def _effective_capture_points(area: Area) -> float:
    return float(area.capture_points) if area.capture_points is not None else float(area.city.default_capture_points)


def _effective_hold_rate(area: Area) -> float:
    return (
        float(area.hold_points_per_minute)
        if area.hold_points_per_minute is not None
        else float(area.city.default_hold_points_per_minute)
    )


def _full_minutes_between(start: datetime, end: datetime) -> int:
    if end <= start:
        return 0
    return floor((end - start).total_seconds() / 60)


def _serialize_submissions(
    db: Session,
    session: GameSession,
) -> list[dict]:
    submissions = (
        db.query(Submission)
        .filter(Submission.game_session_id == session.id)
        .order_by(Submission.created_at.asc())
        .all()
    )
    teams = {t.id: t for t in db.query(Team).filter(Team.game_session_id == session.id).all()}
    areas = {a.id: a for a in db.query(Area).filter(Area.city_id == session.city_id).all()}
    challenges = {c.area_id: c for c in db.query(Challenge).all()}
    approvals = {a.submission_id: a for a in db.query(Approval).all()}

    result = []
    for sub in submissions:
        team = teams.get(sub.team_id)
        area = areas.get(sub.area_id)
        challenge = challenges.get(sub.area_id)
        approval = approvals.get(sub.id)
        result.append(
            {
                "id": sub.id,
                "team_id": sub.team_id,
                "team_name": team.name if team else None,
                "area_id": sub.area_id,
                "area_name": area.name if area else None,
                "challenge_title": challenge.title if challenge else None,
                "text": sub.text,
                "score": sub.score,
                "status": sub.status.value,
                "created_at": sub.created_at.isoformat(),
                "media_urls": [m.url for m in sub.media],
                "approval": (
                    {
                        "admin_team_id": approval.admin_team_id,
                        "decision": approval.decision.value,
                        "message": approval.message,
                        "decided_at": approval.decided_at.isoformat(),
                    }
                    if approval
                    else None
                ),
            }
        )
    return result


def get_session_results_payload(db: Session, session: GameSession) -> dict:
    """Build public/session results payload: metadata, final standings, points history."""
    teams = db.query(Team).filter(Team.game_session_id == session.id).all()
    areas = db.query(Area).filter(Area.city_id == session.city_id).all()
    points_history, final_standings = _compute_points_history(db, session)
    return {
        "session_id": session.id,
        "join_code": session.join_code,
        "city_name": session.city.name if session.city else None,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "published_at": session.published_at.isoformat() if session.published_at else None,
        "is_finished": session.is_finished,
        "team_count": len([t for t in teams if not t.is_admin]),
        "area_count": len(areas),
        "final_standings": final_standings,
        "points_history": points_history,
    }


def _media_file_path_from_url(raw_url: str) -> Path | None:
    """Resolve local media URL/path to filesystem path."""
    if not raw_url:
        return None
    if "://" in raw_url:
        parsed = urlparse(raw_url)
        media_path = parsed.path
    else:
        media_path = raw_url

    if not media_path.startswith("/media/"):
        return None

    relative_media = media_path[len("/media/"):].lstrip("/")
    return Path(settings.MEDIA_LOCAL_PATH) / relative_media


def _add_media_files_to_zip(zip_file: zipfile.ZipFile, submissions: list[Submission]) -> int:
    """Add locally stored media files to zip under media/ directory."""
    added_files = 0
    seen_paths: set[str] = set()
    for submission in submissions:
        for media in submission.media:
            fs_path = _media_file_path_from_url(media.url)
            if not fs_path:
                continue
            fs_path_str = str(fs_path.resolve())
            if fs_path_str in seen_paths:
                continue
            if not fs_path.exists() or not fs_path.is_file():
                continue
            arcname = f"media/{fs_path.relative_to(Path(settings.MEDIA_LOCAL_PATH)).as_posix()}"
            zip_file.write(fs_path, arcname=arcname)
            seen_paths.add(fs_path_str)
            added_files += 1
    return added_files


def _compute_points_history(
    db: Session,
    session: GameSession,
) -> tuple[list[dict], list[dict]]:
    """
    Replay approved submissions and generate:
    - history rows (snapshot per event + start/end)
    - final standings
    """
    teams = (
        db.query(Team)
        .filter(Team.game_session_id == session.id, Team.is_admin == False)
        .order_by(Team.name.asc())
        .all()
    )
    if not teams:
        return [], []

    areas = db.query(Area).filter(Area.city_id == session.city_id).all()
    area_by_id = {a.id: a for a in areas}
    challenge_by_area_id = {c.area_id: c for c in db.query(Challenge).filter(Challenge.area_id.in_(area_by_id.keys())).all()}

    approved_submissions = (
        db.query(Submission, Approval)
        .join(Approval, Approval.submission_id == Submission.id)
        .filter(
            Submission.game_session_id == session.id,
            Approval.decision == SubmissionStatus.APPROVED,
        )
        .order_by(Approval.decided_at.asc(), Submission.id.asc())
        .all()
    )

    # area state
    area_owner: dict[int, int | None] = {a.id: None for a in areas}
    area_captured_at: dict[int, datetime | None] = {a.id: None for a in areas}
    area_high_score: dict[int, float | None] = {a.id: None for a in areas}

    points = defaultdict(float)  # total points per team
    territory_count = defaultdict(int)

    for t in teams:
        points[t.id] = 0.0
        territory_count[t.id] = 0

    effective_end = session.end_time or datetime.utcnow()
    start_time = session.started_at or session.created_at
    last_tick = start_time

    history: list[dict] = []

    def snapshot(timestamp: datetime, event: str):
        for t in teams:
            history.append(
                {
                    "timestamp": timestamp.isoformat(),
                    "event": event,
                    "team_id": t.id,
                    "team_name": t.name,
                    "points": round(points[t.id], 2),
                    "territories": territory_count[t.id],
                }
            )

    def accrue_until(target: datetime):
        nonlocal last_tick
        if target <= last_tick:
            return
        for area in areas:
            owner = area_owner[area.id]
            captured_at = area_captured_at[area.id]
            if owner is None or captured_at is None:
                continue
            start = max(captured_at, last_tick)
            full_minutes = _full_minutes_between(start, target)
            if full_minutes > 0:
                points[owner] += full_minutes * _effective_hold_rate(area)
                area_captured_at[area.id] = start + timedelta(minutes=full_minutes)
        last_tick = target

    snapshot(start_time, "session_start")

    for sub, approval in approved_submissions:
        decision_time = approval.decided_at
        if decision_time > effective_end:
            break

        accrue_until(decision_time)

        area = area_by_id.get(sub.area_id)
        challenge = challenge_by_area_id.get(sub.area_id)
        if not area or not challenge:
            continue

        previous_owner = area_owner[area.id]
        new_owner = previous_owner

        if challenge.mode == ChallengeMode.LAST_APPROVED_WINS:
            new_owner = sub.team_id
            area_high_score[area.id] = sub.score
        else:
            if sub.score is not None and (area_high_score[area.id] is None or sub.score > area_high_score[area.id]):
                new_owner = sub.team_id
                area_high_score[area.id] = sub.score

        if new_owner != previous_owner:
            if previous_owner is not None:
                territory_count[previous_owner] = max(0, territory_count[previous_owner] - 1)
            if new_owner is not None:
                territory_count[new_owner] += 1
                points[new_owner] += _effective_capture_points(area)
                area_captured_at[area.id] = decision_time
            else:
                area_captured_at[area.id] = None
            area_owner[area.id] = new_owner

        snapshot(decision_time, f"approval_{sub.id}")

    accrue_until(effective_end)
    snapshot(effective_end, "session_end")

    standings = [
        {
            "team_id": t.id,
            "team_name": t.name,
            "team_color": t.color,
            "points": round(points[t.id], 2),
            "territories": territory_count[t.id],
        }
        for t in teams
    ]
    standings.sort(key=lambda x: (-x["points"], -x["territories"], x["team_name"].lower()))
    for idx, row in enumerate(standings, start=1):
        row["rank"] = idx

    return history, standings


def create_export_zip(db: Session, session_id: int) -> io.BytesIO:
    """Create ZIP with results for a specific game session."""
    session = db.query(GameSession).filter(GameSession.id == session_id).first()
    if not session:
        raise ValueError(f"Session not found: {session_id}")

    submissions = (
        db.query(Submission)
        .filter(Submission.game_session_id == session.id)
        .order_by(Submission.created_at.asc())
        .all()
    )
    submissions_data = _serialize_submissions(db, session)
    points_history, final_standings = _compute_points_history(db, session)
    teams = db.query(Team).filter(Team.game_session_id == session.id).all()
    areas = db.query(Area).filter(Area.city_id == session.city_id).all()

    metadata = {
        "exported_at": datetime.utcnow().isoformat(),
        "session_id": session.id,
        "city_id": session.city_id,
        "city_name": session.city.name if session.city else None,
        "duration_minutes": session.duration_minutes,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "published_at": session.published_at.isoformat() if session.published_at else None,
        "is_active": session.is_active,
        "is_finished": session.is_finished,
        "team_count": len([t for t in teams if not t.is_admin]),
        "area_count": len(areas),
        "submission_count": len(submissions_data),
    }

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False))
        zip_file.writestr("submissions.json", json.dumps(submissions_data, indent=2, ensure_ascii=False))
        zip_file.writestr("final_standings.json", json.dumps(final_standings, indent=2, ensure_ascii=False))
        zip_file.writestr("points_history.json", json.dumps(points_history, indent=2, ensure_ascii=False))

        standings_csv = io.StringIO()
        writer = csv.writer(standings_csv)
        writer.writerow(["rank", "team_id", "team_name", "team_color", "points", "territories"])
        for row in final_standings:
            writer.writerow([row["rank"], row["team_id"], row["team_name"], row["team_color"], row["points"], row["territories"]])
        zip_file.writestr("final_standings.csv", standings_csv.getvalue())

        history_csv = io.StringIO()
        writer = csv.writer(history_csv)
        writer.writerow(["timestamp", "event", "team_id", "team_name", "points", "territories"])
        for row in points_history:
            writer.writerow([row["timestamp"], row["event"], row["team_id"], row["team_name"], row["points"], row["territories"]])
        zip_file.writestr("points_history.csv", history_csv.getvalue())

        media_files = _add_media_files_to_zip(zip_file, submissions)
        zip_file.writestr(
            "media/README.txt",
            (
                "Deze map bevat geuploade foto's/video's voor deze sessie.\n"
                f"Aantal bestanden toegevoegd: {media_files}\n"
            ),
        )

    zip_buffer.seek(0)
    logger.info(f"Created export ZIP for session {session_id}")
    return zip_buffer
