#!/bin/bash
# ───────────────────────────────────────────────────────────────
# KFM Delice — PostgreSQL Backup Script
# Usage:
#   ./scripts/backup-postgres.sh
# Or via cron:
#   0 2 * * * /path/to/scripts/backup-postgres.sh
# ───────────────────────────────────────────────────────────────
set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/kfm-delice-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting PostgreSQL backup..."
echo "[backup] File: $BACKUP_FILE"

if [ -z "$DATABASE_URL" ]; then
  echo "[backup] FATAL: DATABASE_URL is not set"
  exit 1
fi

# Dump and compress
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Verify
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] ✓ Backup created ($SIZE)"

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "kfm-delice-*.sql.gz" -mtime +7 -delete 2>/dev/null || true
echo "[backup] Old backups cleaned (>7 days)"

# List recent backups
echo "[backup] Recent backups:"
ls -lh "$BACKUP_DIR"/kfm-delice-*.sql.gz 2>/dev/null | tail -5

echo "[backup] Done."
