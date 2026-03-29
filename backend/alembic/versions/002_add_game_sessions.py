"""add game sessions

Revision ID: 002
Revises: 001
Create Date: 2026-01-28 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_game_sessions'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create game_sessions table
    op.create_table('game_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('city_id', sa.Integer(), nullable=False),
        sa.Column('join_code', sa.String(length=20), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_finished', sa.Boolean(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['city_id'], ['cities.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_game_sessions_id'), 'game_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_game_sessions_join_code'), 'game_sessions', ['join_code'], unique=True)
    op.create_index(op.f('ix_game_sessions_is_active'), 'game_sessions', ['is_active'], unique=False)
    
    # Add game_session_id to teams table
    op.add_column('teams', sa.Column('game_session_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_teams_game_session_id'), 'teams', ['game_session_id'], unique=False)
    op.create_foreign_key('fk_teams_game_session', 'teams', 'game_sessions', ['game_session_id'], ['id'])
    
    # Drop old unique constraint on teams.name (check all possible names)
    conn = op.get_bind()
    constraint_name = conn.execute(sa.text("""
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'teams'::regclass 
        AND contype = 'u' 
        AND conname LIKE '%name%'
    """)).fetchone()
    
    if constraint_name:
        op.drop_constraint(constraint_name[0], 'teams', type_='unique')
    
    # Add new partial unique index for name per session (only for non-admin teams)
    op.create_index(
        'idx_team_name_per_session',
        'teams',
        ['game_session_id', 'name'],
        unique=True,
        postgresql_where=sa.text('is_admin = false')
    )
    
    # Add game_session_id to submissions table
    op.add_column('submissions', sa.Column('game_session_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_submissions_game_session_id'), 'submissions', ['game_session_id'], unique=False)
    op.create_foreign_key('fk_submissions_game_session', 'submissions', 'game_sessions', ['game_session_id'], ['id'])
    
    # Make game_id nullable (for backward compatibility)
    op.alter_column('submissions', 'game_id', nullable=True)


def downgrade() -> None:
    # Remove game_session_id from submissions
    op.drop_constraint('fk_submissions_game_session', 'submissions', type_='foreignkey')
    op.drop_index(op.f('ix_submissions_game_session_id'), table_name='submissions')
    op.drop_column('submissions', 'game_session_id')
    
    # Make game_id required again
    op.alter_column('submissions', 'game_id', nullable=False)
    
    # Remove partial unique index and restore old constraint on teams
    op.drop_index('idx_team_name_per_session', table_name='teams')
    op.create_unique_constraint('teams_name_key', 'teams', ['name'])
    
    # Remove game_session_id from teams
    op.drop_constraint('fk_teams_game_session', 'teams', type_='foreignkey')
    op.drop_index(op.f('ix_teams_game_session_id'), table_name='teams')
    op.drop_column('teams', 'game_session_id')
    
    # Drop game_sessions table
    op.drop_index(op.f('ix_game_sessions_is_active'), table_name='game_sessions')
    op.drop_index(op.f('ix_game_sessions_join_code'), table_name='game_sessions')
    op.drop_index(op.f('ix_game_sessions_id'), table_name='game_sessions')
    op.drop_table('game_sessions')
