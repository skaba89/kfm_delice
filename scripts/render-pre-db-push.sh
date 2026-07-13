#!/bin/bash
# ────────────────────────────────────────────────────────────────────
# render-pre-db-push.sh — Drop conflicting tables before prisma db push
#
# Problem: The safety-net in db.ts creates tables with raw SQL using
# TEXT/INTEGER types. When prisma db push tries to sync the schema,
# it can't change column types (e.g. TEXT → BIGINT) without dropping
# the table. Since these tables are NEW (empty), we can safely drop
# them and let prisma db push recreate them with the correct types.
#
# This script runs BEFORE prisma db push in render-start.sh.
# It only drops tables that are EMPTY (no data loss).
# ────────────────────────────────────────────────────────────────────

set -e

echo "[render-pre-db-push] Dropping empty conflicting tables..."

# Only run on PostgreSQL
case "$DATABASE_URL" in
  postgresql://*|postgres://*) ;;
  *) echo "[render-pre-db-push] Not PostgreSQL — skipping"; exit 0 ;;
esac

# Use prisma to execute raw SQL via a temporary script
# We use psql directly if available, otherwise use node
if command -v psql &> /dev/null; then
  PSQL="psql"
else
  PSQL=""
fi

# Function to drop a table if it exists and is empty
drop_if_empty() {
  local table="$1"
  local count
  
  if [ -n "$PSQL" ]; then
    count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"$table\"" 2>/dev/null | xargs)
  else
    # Use node + prisma to check
    count=$(node -e "
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      p.\$queryRawUnsafe('SELECT COUNT(*)::int as count FROM \"${table}\"')
        .then(r => { console.log(r[0].count); process.exit(0); })
        .catch(() => { console.log(-1); process.exit(0); });
    " 2>/dev/null || echo "-1")
  fi
  
  if [ "$count" = "0" ]; then
    echo "[render-pre-db-push]   DROP TABLE \"$table\" (empty — safe to drop)"
    if [ -n "$PSQL" ]; then
      psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS \"$table\" CASCADE" 2>/dev/null || true
    else
      node -e "
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        p.\$executeRawUnsafe('DROP TABLE IF EXISTS \"${table}\" CASCADE')
          .then(() => process.exit(0))
          .catch(() => process.exit(0));
      " 2>/dev/null || true
    fi
  elif [ "$count" = "-1" ]; then
    echo "[render-pre-db-push]   Table \"$table\" does not exist — skip"
  else
    echo "[render-pre-db-push]   Table \"$table\" has $count rows — KEEP (not dropping)"
  fi
}

# Drop empty tables that may have wrong column types
# (created by the safety-net with TEXT instead of BIGINT)
drop_if_empty "PromoCode"
drop_if_empty "ChatMessage"
drop_if_empty "LoyaltyTier"
# RestaurantTable might have data — only drop if empty
drop_if_empty "RestaurantTable"

echo "[render-pre-db-push] Done — prisma db push will recreate tables with correct types"
