#!/bin/bash
set -e

echo "=== Running migrations ==="
cd /app/backend
alembic upgrade head

echo "=== Seeding database ==="
python -m app.seeds.seed_required_data

echo "=== Starting server ==="
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
