#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"

# ── Detect database provider from DATABASE_URL ─────────────────
# NEVER override DATABASE_URL on Render — Render injects a real PostgreSQL URL.
# If DATABASE_URL is missing in production, fail loudly instead of silently
# falling back to SQLite (which would mask a misconfigured deployment).
detect_provider() {
  case "$DATABASE_URL" in
    postgresql://*|postgres://*) echo "postgres" ;;
    file:*)                       echo "sqlite" ;;
    *)                            echo "unknown" ;;
  esac
}

if [ -z "$DATABASE_URL" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    echo "[render-start] FATAL: DATABASE_URL is not set in production. Refusing to start."
    exit 1
  fi
  export DATABASE_URL="file:./data/kfm-delice.db"
  echo "[render-start] DATABASE_URL was missing, defaulted to: $DATABASE_URL"
fi

PROVIDER=$(detect_provider)
echo "[render-start] Detected provider: $PROVIDER"

if [ "$PROVIDER" = "unknown" ]; then
  echo "[render-start] FATAL: DATABASE_URL must start with 'file:', 'postgresql://' or 'postgres://'. Got a different scheme."
  exit 1
fi

# ── Apply schema & migrations ──────────────────────────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Switching schema to PostgreSQL..."
  if [ -f "prisma/schema.postgres.prisma" ]; then
    cp prisma/schema.postgres.prisma prisma/schema.prisma
  fi

  # Primary path: prisma migrate deploy (safe, never loses data)
  echo "[render-start] Running prisma migrate deploy..."
  if ! npx prisma migrate deploy 2>&1; then
    echo "[render-start] WARNING: prisma migrate deploy failed."
    echo "[render-start] Falling back to 'prisma db push' (no --accept-data-loss)."
    # Fallback is intentional but NEVER with --accept-data-loss in production.
    npx prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
  fi
else
  echo "[render-start] Switching schema to SQLite..."
  if [ -f "prisma/schema.sqlite.prisma" ]; then
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
  fi
  mkdir -p data
  # SQLite is local/dev only — db push is acceptable here, but still
  # never with --accept-data-loss in production.
  if [ "$NODE_ENV" = "production" ]; then
    echo "[render-start] Pushing SQLite schema (no --accept-data-loss)..."
    npx prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
  else
    echo "[render-start] Pushing SQLite schema (dev mode)..."
    npx prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
  fi

  # Force-add missing columns that prisma db push might miss
  # (handles DBs created with an older schema)
  echo "[render-start] Ensuring all columns exist..."
  node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  async function fix() {
    const cols = [
      ['Admin', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
      ['Customer', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
      ['Driver', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
    ];
    for (const [tbl, col, def] of cols) {
      try {
        await prisma.\$executeRawUnsafe('ALTER TABLE ' + tbl + ' ADD COLUMN ' + col + ' ' + def);
        console.log('[fix] Added ' + col + ' to ' + tbl);
      } catch(e) {
        if (e.message.includes('duplicate column')) console.log('[fix] ' + tbl + '.' + col + ' already exists');
        else console.log('[fix] ' + tbl + ' check:', e.message);
      }
    }
    await prisma.\$disconnect();
  }
  fix();
  " 2>&1 || echo "[render-start] Column fix warning, continuing..."
fi

# ── Seed if empty ──────────────────────────────────────────────
echo "[render-start] Checking if database needs seeding..."
node scripts/auto-seed.cjs 2>&1 || echo "[render-start] Auto-seed warning, continuing..."

# ── Start the Next.js standalone server ────────────────────────
echo "[render-start] Starting Next.js server on $HOSTNAME:$PORT..."
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec node .next/standalone/server.js
