"""Leaderboard endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.db.models import Team, GameSession
from app.services.ownership import compute_team_scores
from app.core.security import get_current_team

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


# Schemas
class LeaderboardEntry(BaseModel):
    team_id: int
    team_name: str
    team_color: str
    points: float
    territory_count: int
    rank: int


class LeaderboardResponse(BaseModel):
    leaderboard: List[LeaderboardEntry]


@router.get("/", response_model=LeaderboardResponse)
def get_leaderboard_endpoint(
    db: Session = Depends(get_db),
    team: Team = Depends(get_current_team)
):
    """
    Get current leaderboard showing teams ranked by points.
    Filtered by the logged-in team's game session.
    Accessible to all authenticated users.
    """
    # Determine which session to show leaderboard for
    session = None
    if team.game_session_id:
        session = db.query(GameSession).filter(GameSession.id == team.game_session_id).first()
    elif team.is_admin:
        session = db.query(GameSession).filter(GameSession.is_active == True).first()

    # No active session means no live leaderboard.
    if not session or not session.is_active:
        return LeaderboardResponse(leaderboard=[])
    
    score_rows = compute_team_scores(db, session)
    teams = db.query(Team).filter(Team.game_session_id == session.id, Team.is_admin == False).all()
    teams_by_id = {team.id: team for team in teams}

    sortable_rows = []
    for row in score_rows:
        team_obj = teams_by_id.get(row["team_id"])
        if not team_obj:
            continue
        sortable_rows.append({
            "team_id": team_obj.id,
            "team_name": team_obj.name,
            "team_color": team_obj.color,
            "points": round(float(row["points"]), 2),
            "territory_count": int(row["territory_count"]),
        })

    sortable_rows.sort(
        key=lambda r: (-r["points"], -r["territory_count"], r["team_name"].lower())
    )

    entries = [
        LeaderboardEntry(
            team_id=row["team_id"],
            team_name=row["team_name"],
            team_color=row["team_color"],
            points=row["points"],
            territory_count=row["territory_count"],
            rank=index + 1,
        )
        for index, row in enumerate(sortable_rows)
    ]

    return LeaderboardResponse(leaderboard=entries)
