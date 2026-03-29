"""Remove game_id from submissions

Revision ID: 003_remove_game_id
Revises: 002_add_game_sessions
Create Date: 2026-02-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_remove_game_id'
down_revision = '002_add_game_sessions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the foreign key constraint first
    op.drop_constraint('submissions_game_id_fkey', 'submissions', type_='foreignkey')
    
    # Drop the column
    op.drop_column('submissions', 'game_id')


def downgrade() -> None:
    # Add column back
    op.add_column('submissions', sa.Column('game_id', sa.Integer(), nullable=True))
    
    # Re-create foreign key
    op.create_foreign_key('submissions_game_id_fkey', 'submissions', 'game', ['game_id'], ['id'])
