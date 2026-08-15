#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

for var_name in SOURCE_DATABASE_URL RESTORE_DATABASE_URL; do
  value="${!var_name}"
  if [[ "$value" != postgres://* && "$value" != postgresql://* ]]; then
    echo "[restore-equivalence] ERROR: ${var_name} must be PostgreSQL" >&2
    exit 2
  fi
done

if [[ "$SOURCE_DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo "[restore-equivalence] ERROR: source and restore URLs must be different" >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[restore-equivalence] ERROR: psql is required" >&2
  exit 2
fi

list_public_tables() {
  local database_url="$1"
  psql "$database_url" \
    --set ON_ERROR_STOP=on \
    --tuples-only \
    --no-align \
    -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
}

count_rows() {
  local database_url="$1"
  local table="$2"

  # All KFM/Prisma table names are simple SQL identifiers. Reject anything
  # unexpected before interpolating the identifier into the read-only query.
  if [[ ! "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "[restore-equivalence] ERROR: unsafe table identifier: $table" >&2
    exit 2
  fi

  psql "$database_url" \
    --set ON_ERROR_STOP=on \
    --tuples-only \
    --no-align \
    -c "SELECT COUNT(*) FROM \"${table}\";" | tr -d '[:space:]'
}

source_tables="$(list_public_tables "$SOURCE_DATABASE_URL")"
restore_tables="$(list_public_tables "$RESTORE_DATABASE_URL")"

if [[ -z "$source_tables" ]]; then
  echo "[restore-equivalence] ERROR: source database has no public base tables" >&2
  exit 1
fi

if ! grep -qx '_prisma_migrations' <<<"$source_tables"; then
  echo "[restore-equivalence] ERROR: source database is missing _prisma_migrations" >&2
  exit 1
fi

if [[ "$source_tables" != "$restore_tables" ]]; then
  echo "[restore-equivalence] FAIL: public table sets differ" >&2
  diff -u <(printf '%s\n' "$source_tables") <(printf '%s\n' "$restore_tables") || true
  exit 1
fi

echo "[restore-equivalence] Public table set matches. Comparing row counts..."
while IFS= read -r table; do
  [[ -n "$table" ]] || continue
  source_count="$(count_rows "$SOURCE_DATABASE_URL" "$table")"
  restore_count="$(count_rows "$RESTORE_DATABASE_URL" "$table")"

  if [[ ! "$source_count" =~ ^[0-9]+$ || ! "$restore_count" =~ ^[0-9]+$ ]]; then
    echo "[restore-equivalence] ERROR: invalid count for ${table}" >&2
    exit 1
  fi

  if [[ "$source_count" != "$restore_count" ]]; then
    echo "[restore-equivalence] FAIL table=${table} source=${source_count} restore=${restore_count}" >&2
    exit 1
  fi

  echo "[restore-equivalence] ✓ ${table}: ${source_count}"
done <<<"$source_tables"

echo "[restore-equivalence] PASS — table set and row counts are equivalent."
