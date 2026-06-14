#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"

# Fix DATABASE_URL if it doesn't start with 'file:' (SQLite requirement)
# Render dashboard might have set it incorrectly
if [ -z "$DATABASE_URL" ] || [[ ! "$DATABASE_URL" == file:* ]]; then
  export DATABASE_URL="file:./data/kfm-delice.db"
  echo "[render-start] DATABASE_URL was missing or invalid, fixed to: $DATABASE_URL"
else
  echo "[render-start] DATABASE_URL=$DATABASE_URL"
fi

# Create data directory for SQLite
mkdir -p data

# Push database schema (creates tables if missing)
echo "[render-start] Pushing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[render-start] prisma db push warning, continuing..."

# Run comprehensive schema migration to ensure ALL columns exist
# This handles the case where prisma db push missed some columns
echo "[render-start] Running comprehensive schema migration..."
node scripts/ensure-schema.cjs 2>&1 || echo "[render-start] Schema migration warning, continuing..."

# Seed if empty
echo "[render-start] Checking if database needs seeding..."
node scripts/auto-seed.cjs || echo "[render-start] Auto-seed warning, continuing..."

# Start the Next.js standalone server
echo "[render-start] Starting Next.js server..."
export HOSTNAME="0.0.0.0"
exec node .next/standalone/server.js
