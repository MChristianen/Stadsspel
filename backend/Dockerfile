FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2 and geoalchemy2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry==1.8.2

# Copy dependency files first (better caching)
COPY pyproject.toml poetry.lock* ./

# Install dependencies (no dev, no virtualenv in container)
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main

# Copy application code
COPY backend/ ./backend/
COPY backend/alembic.ini ./

# Create media directory
RUN mkdir -p /app/media/submissions /app/media/exports

# Set working directory to backend
WORKDIR /app/backend

EXPOSE 8000

# Startup script: run migrations, seed, then start server
COPY deploy/start-backend.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
