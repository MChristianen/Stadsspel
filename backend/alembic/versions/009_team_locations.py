"""Add team_locations table for live GPS tracking.

Revision ID: 009_team_locations
Revises: 008_tikker_and_score
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa

revision = "009_team_locations"
down_revision = "008_tikker_and_score"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "team_locations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("team_id", sa.Integer, sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game_session_id", sa.Integer, sa.ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_team_locations_session", "team_locations", ["game_session_id"])
    op.create_unique_constraint("uq_team_location_per_session", "team_locations", ["team_id", "game_session_id"])


def downgrade():
    op.drop_table("team_locations")
