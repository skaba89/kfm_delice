#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# scripts/backup-postgres.sh — Backup PostgreSQL DB to a compressed .sql.gz file
# ───────────────────────────────────────────────────────────────────
# Usage:
#   bash scripts/backup-postgres.sh                  # uses $DATABASE_URL
#   bash scripts/backup-postgres.sh /custom/path     # custom backup dir
#   BACKUP_RETENTION_DAYS=14 bash scripts/backup-postgres.sh
#
# Cron example (daily at 2 AM, keep 14 days):
#   0 2 * * * cd /home/z/my-project && bash scripts/backup-postgres.sh >> /var/log/kfm-backup.log 2>&1
#
# Restoring:
#   gunzip -c backups/kfm-delice-2026-06-18.sql.gz | psql "$DATABASE_URL"
# ───────────────────────────────────────────────────────────────────
set -e

BACKUP_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/kfm-delice-${TIMESTAMP}.sql.gz"

# ── Validate env ─────────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  echo "[backup] ERROR: DATABASE_URL not set"
  exit 1
fi
case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *)
    echo "[backup] ERROR: DATABASE_URL is not a PostgreSQL URL (got: ${DATABASE_URL:0:20}...)"
    echo "         Set DATABASE_URL=postgresql://user:pass@host:5432/dbname"
    exit 1
    ;;
esac

# ── Prepare backup dir ───────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
echo "[backup] Backup directory: $(pwd)/$BACKUP_DIR"

# ── Parse DATABASE_URL ───────────────────────────────────────────
# Format: postgresql://USER:PASS@HOST:PORT/DBNAME?schema=public
URL_NO_QUERY="${DATABASE_URL%%\?*}"
USER_PASS_HOST_PORT_DB="${URL_NO_QUERY#postgresql://}"
USER_PASS_HOST_PORT_DB="${USER_PASS_HOST_PORT_DB#postgres://}"

DB_NAME="${USER_PASS_HOST_PORT_DB##*/}"
USER_PASS_HOST_PORT="${USER_PASS_HOST_PORT_DB%/*}"
HOST_PORT="${USER_PASS_HOST_PORT##*@}"
DB_USER="${USER_PASS_HOST_PORT%@*}"
DB_PASS="${DB_USER#*:}"
DB_USER="${DB_USER%%:*}"
DB_HOST="${HOST_PORT%%:*}"
DB_PORT="${HOST_PORT##*:}"
if [ "$DB_PORT" = "$DB_HOST" ]; then
  DB_PORT="5432"
fi

echo "[backup] Host: $DB_HOST:$DB_PORT  DB: $DB_NAME  User: $DB_USER"

# ── Run pg_dump ──────────────────────────────────────────────────
export PGPASSWORD="$DB_PASS"
echo "[backup] Starting pg_dump → $BACKUP_FILE"
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --compress=9 \
  --file="$BACKUP_FILE"

unset PGPASSWORD

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[backup] ERROR: backup file not created"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] ✅ Created: $BACKUP_FILE ($BACKUP_SIZE)"

# ── Cleanup old backups ──────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "kfm-delice-*.sql.gz" -type f -mtime +$RETENTION_DAYS -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[backup] 🗑️  Deleted $DELETED backup(s) older than $RETENTION_DAYS days"
fi

# ── List current backups ─────────────────────────────────────────
echo "[backup] Current backups:"
ls -lh "$BACKUP_DIR"/kfm-delice-*.sql.gz 2>/dev/null | awk '{printf "  %s  %s\n", $5, $9}'

echo "[backup] Done."
