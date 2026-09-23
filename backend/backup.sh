#!/bin/bash
set -e

cd "$(dirname "$0")"

# Reads the same DATABASE_URL the app itself uses, so this stays in sync
# with whichever database is actually configured — no separate place to
# keep connection details up to date. Falls back to the legacy SQLite
# path when DATABASE_URL isn't set (local, no-Docker dev).
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  set -a
  source .env
  set +a
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

if [[ "$DATABASE_URL" == postgresql* ]]; then
  # Parse postgresql+psycopg2://user:pass@host:port/dbname
  proto_stripped="${DATABASE_URL#*://}"
  creds="${proto_stripped%%@*}"
  hostpart="${proto_stripped#*@}"
  PGUSER="${creds%%:*}"
  export PGPASSWORD="${creds#*:}"
  PGHOST="${hostpart%%:*}"
  rest="${hostpart#*:}"
  PGPORT="${rest%%/*}"
  PGDATABASE="${rest#*/}"

  pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -Fc -f "$BACKUP_DIR/postgres.dump" "$PGDATABASE"
else
  # Legacy SQLite path — uses SQLite's own backup API, correct even
  # while the app is running and writing to data.db, unlike a plain
  # file copy.
  sqlite3 data.db ".backup '$BACKUP_DIR/data.db'"
fi

# Real generated content — images, published copies, uploaded logos.
# Real money and time went into these; losing them is not "just re-run it."
tar -czf "$BACKUP_DIR/content.tar.gz" output/ publish/ watermarks/ 2>/dev/null || true

echo "Backup created: $BACKUP_DIR"

# Rotation — keep the last 14 backups, delete anything older.
cd backups
ls -1t | tail -n +15 | xargs -r rm -rf
