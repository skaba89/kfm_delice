#!/usr/bin/env bash
set -euo pipefail

# KFM Delice — operator-side PostgreSQL logical backup.
# Read-only against the source DB. Complements provider-managed backups/PITR.
#
# Usage:
#   DATABASE_URL='postgresql://...' BACKUP_LABEL=pre-deploy ./scripts/backup-postgres.sh

: "${DATABASE_URL:?DATABASE_URL is required}"

if [[ "$DATABASE_URL" != postgres://* && "$DATABASE_URL" != postgresql://* ]]; then
  echo "[backup] ERROR: DATABASE_URL must be PostgreSQL" >&2
  exit 2
fi

for cmd in pg_dump pg_restore sha256sum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[backup] ERROR: $cmd is required (install PostgreSQL client tools)" >&2
    exit 2
  fi
done

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_LABEL="${BACKUP_LABEL:-manual}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SAFE_LABEL="$(printf '%s' "$BACKUP_LABEL" | tr -cs 'A-Za-z0-9._-' '_')"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/kfm-delice_${SAFE_LABEL}_${TIMESTAMP}.dump"
MANIFEST_FILE="$BACKUP_FILE.sha256"
LIST_FILE="$BACKUP_FILE.list.txt"
TMP_FILE="$BACKUP_FILE.partial"

cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

echo "[backup] Creating PostgreSQL custom-format backup..."
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="$TMP_FILE"

# Do not publish a backup until pg_restore can parse its full catalog.
pg_restore --list "$TMP_FILE" > "$LIST_FILE"
mv "$TMP_FILE" "$BACKUP_FILE"

# Write a portable manifest: record only the dump basename, not BACKUP_DIR.
# This keeps `sha256sum --check` semantics valid if the backup directory is
# moved/copied as a unit and avoids duplicating relative directory prefixes.
(
  cd "$(dirname "$BACKUP_FILE")"
  sha256sum "$(basename "$BACKUP_FILE")" > "$(basename "$MANIFEST_FILE")"
)
trap - EXIT

echo "[backup] PASS"
echo "[backup] file=$BACKUP_FILE"
echo "[backup] manifest=$MANIFEST_FILE"
echo "[backup] catalog=$LIST_FILE"
echo "[backup] Retention is intentionally managed outside this script; no backup is auto-deleted."
