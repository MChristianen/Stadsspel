"""Fix global team name uniqueness; keep uniqueness per session for non-admin teams.

Revision ID: 005_fix_team_name_uniqueness
Revises: 004_drop_games_table
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005_fix_team_name_uniqueness"
down_revision = "004_drop_games_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("teams")}

    # Remove legacy global unique index on teams.name if it still exists.
    if "ix_teams_name" in indexes and indexes["ix_teams_name"].get("unique"):
        op.drop_index("ix_teams_name", table_name="teams")

    # Recreate non-unique index for lookup performance.
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("teams")}
    if "ix_teams_name" not in indexes:
        op.create_index("ix_teams_name", "teams", ["name"], unique=False)

    # Ensure partial unique index exists (unique team names per session, non-admin only).
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("teams")}
    if "idx_team_name_per_session" not in indexes:
        op.create_index(
            "idx_team_name_per_session",
            "teams",
            ["game_session_id", "name"],
            unique=True,
            postgresql_where=sa.text("is_admin = false"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("teams")}

    if "idx_team_name_per_session" in indexes:
        op.drop_index("idx_team_name_per_session", table_name="teams")

    indexes = {idx["name"]: idx for idx in inspector.get_indexes("teams")}
    if "ix_teams_name" in indexes:
        op.drop_index("ix_teams_name", table_name="teams")

    op.create_index("ix_teams_name", "teams", ["name"], unique=True)
