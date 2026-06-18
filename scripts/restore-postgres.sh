#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# scripts/restore-postgres.sh — Restore a PostgreSQL DB from a .sql.gz backup
# ───────────────────────────────────────────────────────────────────
# Usage:
#   bash scripts/restore-postgres.sh backups/kfm-delice-2026-06-18_020000.sql.gz
#
# WARNING: This OVERWRITES the target DB. All current data will be lost.
# ───────────────────────────────────────────────────────────────────
set -e

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: bash scripts/restore-postgres.sh <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -1 backups/kfm-delice-*.sql.gz 2>/dev/null | sed 's/^/  /' || echo "  (none found in ./backups/)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] ERROR: backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[restore] ERROR: DATABASE_URL not set"
  exit 1
fi
case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *)
    echo "[restore] ERROR: DATABASE_URL must be a PostgreSQL URL"
    exit 1
    ;;
esac

# Parse URL
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

export PGPASSWORD="$DB_PASS"

echo "[restore] ⚠️  WARNING: this will OVERWRITE database '$DB_NAME' on $DB_HOST:$DB_PORT"
echo "[restore] Backup file: $BACKUP_FILE"
read -p "Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "[restore] Aborted."
  exit 0
fi

echo "[restore] Restoring..."
gunzip -c "$BACKUP_FILE" | psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --quiet \
  --set ON_ERROR_STOP=on

unset PGPASSWORD

echo "[restore] ✅ Restore complete."
echo "[restore] Verifying row counts..."
psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --tuples-only \
  --no-align \
  --field-separator='|' \
  -c "
    SELECT 'Restaurant', COUNT(*) FROM \"Restaurant\" UNION ALL
    SELECT 'Admin', COUNT(*) FROM \"Admin\" UNION ALL
    SELECT 'Customer', COUNT(*) FROM \"Customer\" UNION ALL
    SELECT 'Order', COUNT(*) FROM \"Order\" UNION ALL
    SELECT 'MenuItem', COUNT(*) FROM \"MenuItem\" UNION ALL
    SELECT 'Payment', COUNT(*) FROM \"Payment\";
  " 2>&1 | sed 's/^/  /'
