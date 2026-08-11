#!/usr/bin/env bash
set -euo pipefail

# KFM Delice — restore a verified custom-format backup into a replacement DB.
# This script intentionally does NOT --clean or drop existing objects. The safe
# disaster-recovery path is restore into an empty replacement database, verify,
# then switch traffic/connection configuration.
#
# Usage:
#   RESTORE_DATABASE_URL='postgresql://...' \
#   CONFIRM_RESTORE=RESTORE_TO_EMPTY_DATABASE \
#   ./scripts/restore-postgres.sh backups/kfm-delice_manual_....dump

BACKUP_FILE="${1:-${BACKUP_FILE:-}}"
: "${BACKUP_FILE:?Backup file path is required as argument or BACKUP_FILE}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

if [[ "$RESTORE_DATABASE_URL" != postgres://* && "$RESTORE_DATABASE_URL" != postgresql://* ]]; then
  echo "[restore] ERROR: RESTORE_DATABASE_URL must be PostgreSQL" >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[restore] ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 2
fi
if [[ "${CONFIRM_RESTORE:-}" != "RESTORE_TO_EMPTY_DATABASE" ]]; then
  echo "[restore] REFUSED: set CONFIRM_RESTORE=RESTORE_TO_EMPTY_DATABASE after verifying the target is empty." >&2
  exit 3
fi

for cmd in pg_restore psql sha256sum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[restore] ERROR: $cmd is required (install PostgreSQL client tools)" >&2
    exit 2
  fi
done

MANIFEST_FILE="$BACKUP_FILE.sha256"
if [[ -f "$MANIFEST_FILE" ]]; then
  echo "[restore] Verifying SHA-256 manifest..."
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "$MANIFEST_FILE")")
else
  echo "[restore] WARNING: checksum manifest not found; validating archive catalog only." >&2
fi

# Verify the archive catalog before touching the target database.
pg_restore --list "$BACKUP_FILE" >/dev/null

echo "[restore] Restoring into explicitly confirmed replacement database..."
pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

echo "[restore] Verifying core schema and row counts..."
psql "$RESTORE_DATABASE_URL" \
  --set ON_ERROR_STOP=on \
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
  "

echo "[restore] PASS — restore completed. Run schema readiness and application smoke tests before switching traffic."
