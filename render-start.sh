#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"

# ── Detect database provider from DATABASE_URL ─────────────────
detect_provider() {
  case "$DATABASE_URL" in
    postgresql://*|postgres://*) echo "postgres" ;;
    file:*)                       echo "sqlite" ;;
    "")                           echo "sqlite" ;;
    *)                            echo "sqlite" ;;
  esac
}

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:./data/kfm-delice.db"
  echo "[render-start] DATABASE_URL was missing, defaulted to: $DATABASE_URL"
fi

PROVIDER=$(detect_provider)
echo "[render-start] Detected provider: $PROVIDER"

# ── Apply schema & migrations ──────────────────────────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Switching schema to PostgreSQL..."
  if [ -f "prisma/schema.postgres.prisma" ]; then
    cp prisma/schema.postgres.prisma prisma/schema.prisma
  fi

  # First deploy: run migrations (creates tables)
  # Subsequent deploys: applies any pending migrations
  echo "[render-start] Running prisma migrate deploy..."
  npx prisma migrate deploy 2>&1 || {
    echo "[render-start] prisma migrate deploy failed — falling back to db push"
    npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[render-start] prisma db push warning"
  }
else
  echo "[render-start] Switching schema to SQLite..."
  if [ -f "prisma/schema.sqlite.prisma" ]; then
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
  fi
  mkdir -p data
  echo "[render-start] Pushing SQLite schema..."
  npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[render-start] prisma db push warning"

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
