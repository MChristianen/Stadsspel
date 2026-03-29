"""Initial schema with PostGIS support

Revision ID: 001_initial
Revises: 
Create Date: 2026-01-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
    
    # Create enum types
    op.execute("CREATE TYPE challengemode AS ENUM ('LAST_APPROVED_WINS', 'HIGHEST_SCORE_WINS');")
    op.execute("CREATE TYPE submissionstatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED');")
    op.execute("CREATE TYPE mediatype AS ENUM ('PHOTO', 'VIDEO');")
    
    # Create games table
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
    op.create_index(op.f('ix_games_id'), 'games', ['id'], unique=False)
    op.create_index(op.f('ix_games_is_active'), 'games', ['is_active'], unique=False)
    
    # Create cities table
    op.create_table('cities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cities_id'), 'cities', ['id'], unique=False)
    op.create_index(op.f('ix_cities_name'), 'cities', ['name'], unique=True)
    
    # Create teams table
    op.create_table('teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('photo_url', sa.String(length=500), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_teams_id'), 'teams', ['id'], unique=False)
    op.create_index(op.f('ix_teams_name'), 'teams', ['name'], unique=True)
    op.create_index(op.f('ix_teams_is_admin'), 'teams', ['is_admin'], unique=False)
    
    # Create areas table with PostGIS columns
    op.create_table('areas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('city_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('geom', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
        sa.Column('center_point', geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['city_id'], ['cities.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_areas_id'), 'areas', ['id'], unique=False)
    # GeoAlchemy2 automatically creates GIST indexes for Geometry columns
    # op.create_index('idx_areas_geom', 'areas', ['geom'], unique=False, postgresql_using='gist')
    # op.create_index('idx_areas_center', 'areas', ['center_point'], unique=False, postgresql_using='gist')
    
    # Create challenges table
    op.create_table('challenges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('area_id', sa.Integer(), nullable=False),
        sa.Column('mode', postgresql.ENUM('LAST_APPROVED_WINS', 'HIGHEST_SCORE_WINS', name='challengemode', create_type=False), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('area_id')
    )
    op.create_index(op.f('ix_challenges_id'), 'challenges', ['id'], unique=False)
    
    # Create submissions table
    op.create_table('submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('area_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('status', postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', name='submissionstatus', create_type=False), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], ),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_submissions_id'), 'submissions', ['id'], unique=False)
    op.create_index(op.f('ix_submissions_game_id'), 'submissions', ['game_id'], unique=False)
    op.create_index(op.f('ix_submissions_team_id'), 'submissions', ['team_id'], unique=False)
    op.create_index(op.f('ix_submissions_area_id'), 'submissions', ['area_id'], unique=False)
    op.create_index(op.f('ix_submissions_status'), 'submissions', ['status'], unique=False)
    op.create_index(op.f('ix_submissions_created_at'), 'submissions', ['created_at'], unique=False)
    op.create_index('idx_submissions_team_area', 'submissions', ['team_id', 'area_id'], unique=False)
    op.create_index('idx_submissions_status_created', 'submissions', ['status', 'created_at'], unique=False)
    
    # Create submission_media table
    op.create_table('submission_media',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('media_type', postgresql.ENUM('PHOTO', 'VIDEO', name='mediatype', create_type=False), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_submission_media_id'), 'submission_media', ['id'], unique=False)
    op.create_index(op.f('ix_submission_media_submission_id'), 'submission_media', ['submission_id'], unique=False)
    
    # Create approvals table
    op.create_table('approvals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('admin_team_id', sa.Integer(), nullable=False),
        sa.Column('decision', postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', name='submissionstatus', create_type=False), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('decided_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint("decision IN ('APPROVED', 'REJECTED')", name='check_approval_decision'),
        sa.ForeignKeyConstraint(['admin_team_id'], ['teams.id'], ),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id')
    )
    op.create_index(op.f('ix_approvals_id'), 'approvals', ['id'], unique=False)
    op.create_index(op.f('ix_approvals_submission_id'), 'approvals', ['submission_id'], unique=True)
    
    # Create territory_ownership table
    op.create_table('territory_ownership',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('area_id', sa.Integer(), nullable=False),
        sa.Column('owner_team_id', sa.Integer(), nullable=True),
        sa.Column('current_high_score', sa.Float(), nullable=True),
        sa.Column('last_approved_submission_id', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], ),
        sa.ForeignKeyConstraint(['last_approved_submission_id'], ['submissions.id'], ),
        sa.ForeignKeyConstraint(['owner_team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('area_id')
    )
    op.create_index(op.f('ix_territory_ownership_id'), 'territory_ownership', ['id'], unique=False)
    op.create_index(op.f('ix_territory_ownership_area_id'), 'territory_ownership', ['area_id'], unique=True)
    op.create_index(op.f('ix_territory_ownership_owner_team_id'), 'territory_ownership', ['owner_team_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_territory_ownership_owner_team_id'), table_name='territory_ownership')
    op.drop_index(op.f('ix_territory_ownership_area_id'), table_name='territory_ownership')
    op.drop_index(op.f('ix_territory_ownership_id'), table_name='territory_ownership')
    op.drop_table('territory_ownership')
    
    op.drop_index(op.f('ix_approvals_submission_id'), table_name='approvals')
    op.drop_index(op.f('ix_approvals_id'), table_name='approvals')
    op.drop_table('approvals')
    
    op.drop_index(op.f('ix_submission_media_submission_id'), table_name='submission_media')
    op.drop_index(op.f('ix_submission_media_id'), table_name='submission_media')
    op.drop_table('submission_media')
    
    op.drop_index('idx_submissions_status_created', table_name='submissions')
    op.drop_index('idx_submissions_team_area', table_name='submissions')
    op.drop_index(op.f('ix_submissions_created_at'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_status'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_area_id'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_team_id'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_game_id'), table_name='submissions')
    op.drop_index(op.f('ix_submissions_id'), table_name='submissions')
    op.drop_table('submissions')
    
    op.drop_index(op.f('ix_challenges_id'), table_name='challenges')
    op.drop_table('challenges')
    
    op.drop_index('idx_areas_center', table_name='areas', postgresql_using='gist')
    op.drop_index('idx_areas_geom', table_name='areas', postgresql_using='gist')
    op.drop_index(op.f('ix_areas_id'), table_name='areas')
    op.drop_table('areas')
    
    op.drop_index(op.f('ix_teams_is_admin'), table_name='teams')
    op.drop_index(op.f('ix_teams_name'), table_name='teams')
    op.drop_index(op.f('ix_teams_id'), table_name='teams')
    op.drop_table('teams')
    
    op.drop_index(op.f('ix_cities_name'), table_name='cities')
    op.drop_index(op.f('ix_cities_id'), table_name='cities')
    op.drop_table('cities')
    
    op.drop_index(op.f('ix_games_is_active'), table_name='games')
    op.drop_index(op.f('ix_games_id'), table_name='games')
    op.drop_table('games')
    
    op.execute('DROP TYPE mediatype;')
    op.execute('DROP TYPE submissionstatus;')
    op.execute('DROP TYPE challengemode;')
