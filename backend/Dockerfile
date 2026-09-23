FROM python:3.12-slim
# Deliberately not matching the local dev venv's 3.14 — this is an
# independent deployment environment, and 3.14 is new enough that
# psycopg2-binary has no prebuilt wheel for it yet, forcing a source
# build that then fails on this slim image (missing libc headers).
# 3.12 is well-established; a prebuilt wheel exists, so pip installs it
# directly with no compilation at all.

WORKDIR /app

# libpq-dev + gcc are needed to build psycopg2 from source if a prebuilt
# wheel isn't available for this exact Python/arch combo; harmless to
# keep even when the binary wheel is used. postgresql-client provides
# pg_dump/pg_restore, used by services/backup.py for real database
# backups/restores against Postgres.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# These are also mounted as host volumes in docker-compose.yml so content
# survives a rebuild — creating them here too means a fresh container
# started without those mounts (e.g. a one-off `docker run`) still works.
RUN mkdir -p output publish preview_cache watermarks backups

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
