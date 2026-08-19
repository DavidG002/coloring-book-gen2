#!/bin/bash
set -e

cd "$(dirname "$0")"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

# Safe SQLite backup — uses SQLite's own backup API, correct even while
# the app is running and writing to data.db, unlike a plain file copy.
sqlite3 data.db ".backup '$BACKUP_DIR/data.db'"

# Real generated content — images, published copies, uploaded logos.
# Real money and time went into these; losing them is not "just re-run it."
tar -czf "$BACKUP_DIR/content.tar.gz" output/ publish/ watermarks/ 2>/dev/null || true

echo "Backup created: $BACKUP_DIR"

# Rotation — keep the last 14 backups, delete anything older.
cd backups
ls -1t | tail -n +15 | xargs -r rm -rf
