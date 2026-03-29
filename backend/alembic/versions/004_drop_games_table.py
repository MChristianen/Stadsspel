"""Drop games table

Revision ID: 004_drop_games_table
Revises: 003_remove_game_id
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '004_drop_games_table'
down_revision = '003_remove_game_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the games table
    op.drop_table('games')


def downgrade() -> None:
    # Recreate games table
    op.create_table('games',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('end_time > start_time', name='check_end_after_start'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_games_id', 'games', ['id'])
    op.create_index('ix_games_is_active', 'games', ['is_active'])
