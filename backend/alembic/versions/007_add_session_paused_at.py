"""Add paused_at to game_sessions for pause/resume support.

Revision ID: 007_add_session_paused_at
Revises: 006_points_system
Create Date: 2026-04-20
"""
from alembic import op
import sqlalchemy as sa


revision = "007_add_session_paused_at"
down_revision = "006_points_system"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "game_sessions",
        sa.Column("paused_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_column("game_sessions", "paused_at")
