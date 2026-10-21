#!/bin/sh
# Daily backup of the HFA database (accounts, encrypted health records, photos and documents).
# Usage (from the project folder):  sh deploy/backup.sh
# Schedule:  crontab -e  →  15 2 * * * cd /opt/hfa-silverstrong && sh deploy/backup.sh >> /var/log/hfa-backup.log 2>&1
# Backups stay encrypted at field level; keep FILE_ENCRYPTION_KEY separately (never in the same place).
set -eu
cd "$(dirname "$0")/.."
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p backups
COMPOSE="docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml"

# VACUUM INTO makes a consistent copy while the app keeps running.
$COMPOSE exec -T backend node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/app/data/hfa.sqlite');
db.exec(\"VACUUM INTO '/app/data/backup-$STAMP.sqlite'\");
db.close();"
CONTAINER="$($COMPOSE ps -q backend)"
docker cp "$CONTAINER:/app/data/backup-$STAMP.sqlite" "backups/hfa-$STAMP.sqlite"
$COMPOSE exec -T backend rm -f "/app/data/backup-$STAMP.sqlite"
gzip -9 "backups/hfa-$STAMP.sqlite"
find backups -name 'hfa-*.sqlite.gz' -mtime "+$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) backup written: backups/hfa-$STAMP.sqlite.gz"

# Optional off-server copy (recommended): set BACKUP_BUCKET, e.g. gs://hfa-backups, and install gcloud.
if [ -n "${BACKUP_BUCKET:-}" ]; then
  gcloud storage cp "backups/hfa-$STAMP.sqlite.gz" "$BACKUP_BUCKET/"
  echo "copied to $BACKUP_BUCKET"
fi
