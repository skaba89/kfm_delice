#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"

# Set DATABASE_URL if not already set
export DATABASE_URL="${DATABASE_URL:-file:./data/kfm-delice.db}"
echo "[render-start] DATABASE_URL=$DATABASE_URL"

# Create data directory for SQLite
mkdir -p data

# Push database schema (creates tables if missing)
echo "[render-start] Pushing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[render-start] prisma db push warning"

# Seed if empty
echo "[render-start] Checking if database needs seeding..."
node scripts/auto-seed.cjs || echo "[render-start] Auto-seed warning, continuing..."

# Start the Next.js standalone server
echo "[render-start] Starting Next.js server..."
export HOSTNAME="0.0.0.0"
exec node .next/standalone/server.js
