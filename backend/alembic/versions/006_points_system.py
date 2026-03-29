"""Add points system with capture/hold config and per-area team point tracking.

Revision ID: 006_points_system
Revises: 005_fix_team_name_uniqueness
Create Date: 2026-02-25
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "006_points_system"
down_revision = "005_fix_team_name_uniqueness"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cities", sa.Column("default_capture_points", sa.Float(), nullable=True))
    op.add_column("cities", sa.Column("default_hold_points_per_minute", sa.Float(), nullable=True))

    op.execute("UPDATE cities SET default_capture_points = 60.0 WHERE default_capture_points IS NULL")
    op.execute("UPDATE cities SET default_hold_points_per_minute = 0.6 WHERE default_hold_points_per_minute IS NULL")

    op.alter_column("cities", "default_capture_points", nullable=False)
    op.alter_column("cities", "default_hold_points_per_minute", nullable=False)

    op.add_column("areas", sa.Column("capture_points", sa.Float(), nullable=True))
    op.add_column("areas", sa.Column("hold_points_per_minute", sa.Float(), nullable=True))

    op.add_column("territory_ownership", sa.Column("captured_at", sa.DateTime(), nullable=True))

    op.create_table(
        "area_team_points",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_session_id", sa.Integer(), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("capture_points", sa.Float(), nullable=False, server_default="0"),
        sa.Column("accrued_hold_points", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"]),
        sa.ForeignKeyConstraint(["game_session_id"], ["game_sessions.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_session_id", "area_id", "team_id", name="uq_area_team_points_session_area_team"),
    )
    op.create_index(op.f("ix_area_team_points_id"), "area_team_points", ["id"], unique=False)
    op.create_index(op.f("ix_area_team_points_game_session_id"), "area_team_points", ["game_session_id"], unique=False)
    op.create_index(op.f("ix_area_team_points_area_id"), "area_team_points", ["area_id"], unique=False)
    op.create_index(op.f("ix_area_team_points_team_id"), "area_team_points", ["team_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_area_team_points_team_id"), table_name="area_team_points")
    op.drop_index(op.f("ix_area_team_points_area_id"), table_name="area_team_points")
    op.drop_index(op.f("ix_area_team_points_game_session_id"), table_name="area_team_points")
    op.drop_index(op.f("ix_area_team_points_id"), table_name="area_team_points")
    op.drop_table("area_team_points")

    op.drop_column("territory_ownership", "captured_at")

    op.drop_column("areas", "hold_points_per_minute")
    op.drop_column("areas", "capture_points")

    op.drop_column("cities", "default_hold_points_per_minute")
    op.drop_column("cities", "default_capture_points")
