"""Add proximity fields to cities and challenge_point to areas.

Revision ID: 010_proximity
Revises: 009_team_locations
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

revision = "010_proximity"
down_revision = "009_team_locations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("cities", sa.Column("proximity_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("cities", sa.Column("proximity_radius", sa.Integer(), nullable=False, server_default="150"))
    # geoalchemy2 auto-creates idx_areas_challenge_point when adding a Geometry column
    op.add_column("areas", sa.Column("challenge_point", Geometry("POINT", srid=4326), nullable=True))


def downgrade():
    op.drop_column("areas", "challenge_point")
    op.drop_column("cities", "proximity_radius")
    op.drop_column("cities", "proximity_enabled")
