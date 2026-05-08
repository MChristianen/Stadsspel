"""Add tikker role, score_description, tikker_periods and tikker_transfer_requests.

Revision ID: 008_tikker_and_score
Revises: 007_add_session_paused_at
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa


revision = "008_tikker_and_score"
down_revision = "007_add_session_paused_at"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("teams", sa.Column("is_tikker", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("challenges", sa.Column("score_description", sa.Text(), nullable=True))

    op.create_table(
        "tikker_periods",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("game_session_id", sa.Integer(), sa.ForeignKey("game_sessions.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_tikker_periods_team_session", "tikker_periods", ["team_id", "game_session_id"])

    op.create_table(
        "tikker_transfer_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("game_session_id", sa.Integer(), sa.ForeignKey("game_sessions.id"), nullable=False),
        sa.Column("initiating_team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("target_team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_tikker_requests_session", "tikker_transfer_requests", ["game_session_id"])


def downgrade():
    op.drop_index("idx_tikker_requests_session", table_name="tikker_transfer_requests")
    op.drop_table("tikker_transfer_requests")
    op.drop_index("idx_tikker_periods_team_session", table_name="tikker_periods")
    op.drop_table("tikker_periods")
    op.drop_column("challenges", "score_description")
    op.drop_column("teams", "is_tikker")
