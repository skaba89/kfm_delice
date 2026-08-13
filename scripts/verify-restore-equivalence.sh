#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

if [[ "$SOURCE_DATABASE_URL" != postgres://* && "$SOURCE_DATABASE_URL" != postgresql://* ]]; then
  echo "[restore-equivalence] ERROR: SOURCE_DATABASE_URL must be PostgreSQL" >&2
  exit 2
fi
if [[ "$RESTORE_DATABASE_URL" != postgres://* && "$RESTORE_DATABASE_URL" != postgresql://* ]]; then
  echo "[restore-equivalence] ERROR: RESTORE_DATABASE_URL must be PostgreSQL" >&2
  exit 2
fi
if [[ "$SOURCE_DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo "[restore-equivalence] ERROR: source and restore URLs must be different" >&2
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "[restore-equivalence] ERROR: psql is required" >&2
  exit 2
fi

TABLES=(
  Account
  Restaurant
  Admin
  Customer
  MenuItem
  Order
  Payment
  PlatformSubscription
  PlatformInvoice
  PlatformPayment
  PlatformBillingNotice
  PublicRegistrationIntent
  _prisma_migrations
)

count_rows() {
  local database_url="$1"
  local table="$2"
  psql "$database_url" \
    --set ON_ERROR_STOP=on \
    --tuples-only \
    --no-align \
    -c "SELECT COUNT(*) FROM \"${table}\";" | tr -d '[:space:]'
}

echo "[restore-equivalence] Comparing source and replacement database row counts..."
for table in "${TABLES[@]}"; do
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
done

echo "[restore-equivalence] PASS — all critical row counts match."
