#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"
echo "[render-start] NODE_ENV=${NODE_ENV:-(not set)}"
if [ -n "$DATABASE_URL" ]; then
  echo "[render-start] DATABASE_URL is set (value hidden for security)"
else
  echo "[render-start] DATABASE_URL is NOT SET"
fi

# ── Detect database provider from DATABASE_URL ────────────────
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
  echo "[render-start] FATAL: DATABASE_URL must start with 'file:', 'postgresql://' or 'postgres://'."
  exit 1
fi

# ── Switch schema + regenerate Prisma Client ──────────────────
# We regenerate the Prisma Client at RUNTIME. Because we use
# `next start` (NOT `output: 'standalone'`), the server reads
# Prisma Client directly from node_modules/.prisma/client/ — so
# the regenerated client is the one actually loaded. This is the
# definitive fix for the recurring "URL must start with file:"
# error caused by a stale SQLite client bundled at build time.
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Switching schema to PostgreSQL..."
  cp prisma/schema.postgres.prisma prisma/schema.prisma
elif [ "$PROVIDER" = "sqlite" ]; then
  echo "[render-start] Switching schema to SQLite..."
  cp prisma/schema.sqlite.prisma prisma/schema.prisma
  mkdir -p data
fi

# Verify provider before proceeding
echo "[render-start] Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs

# Regenerate Prisma Client at RUNTIME — this is the actual source
# of truth that `next start` will load (no standalone bundle in the way).
echo "[render-start] Regenerating Prisma Client (provider=$PROVIDER)..."
rm -rf node_modules/.prisma node_modules/@prisma/client
npx prisma generate 2>&1 || {
  echo "[render-start] FATAL: prisma generate failed. Cannot start with a broken client."
  exit 1
}

# ── Diagnostics: verify build output BEFORE starting server ────
# This catches the "503 because .next/ is missing" case at the
# source rather than letting the server crash on first request.
echo "[render-start] Checking Next.js build output..."
test -d .next || echo "[render-start] WARNING: .next directory missing"
test -f .next/BUILD_ID || echo "[render-start] WARNING: .next/BUILD_ID missing"
test -d node_modules || echo "[render-start] WARNING: node_modules missing"
test -d node_modules/@prisma/client || echo "[render-start] WARNING: @prisma/client missing"
test -d node_modules/.prisma/client || echo "[render-start] WARNING: .prisma/client missing"
echo "[render-start] Build output check complete."

# ── Apply schema & migrations ──────────────────────────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Running prisma migrate deploy..."
  if ! npx prisma migrate deploy 2>&1; then
    echo "[render-start] ⚠️  prisma migrate deploy failed — falling back to db push (NO --accept-data-loss)"
    npx prisma db push --skip-generate 2>&1 || echo "[render-start] ⚠️  prisma db push also failed"
  fi

  # Safety net: ensure critical columns/tables exist (in case migrate
  # was incomplete or schema drift happened).
  echo "[render-start] Running ensure-postgres-columns safety check..."
  node scripts/ensure-postgres-columns.cjs 2>&1 || echo "[render-start] ensure-columns warning, continuing..."
else
  echo "[render-start] Pushing SQLite schema..."
  npx prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
fi

# ── Seed FIRST (creates demo data on empty DB) ─────────────────
# IMPORTANT: Auto-seed MUST run BEFORE backfill-accounts.
# On a fresh database:
#   1. auto-seed creates the demo Restaurant + Admins
#   2. backfill-accounts then attaches an Account to those rows
# If we ran backfill first, it would find nothing to link, and the
# demo restaurant/admins created by auto-seed would stay orphan
# (no accountId) until the next restart.
echo "[render-start] Running auto-seed..."
node scripts/auto-seed.cjs 2>&1 || echo "[render-start] Auto-seed warning, continuing..."

# ── Backfill SECOND (attaches Account to seed data) ────────────
# For each Restaurant without accountId:
#   - create an Account
#   - link Restaurant (accountId + type=principal)
#   - link all Admins (accountId, canCreateRestaurant, limits)
# Idempotent — safe to run on every restart.
echo "[render-start] Running SaaS account backfill..."
node scripts/backfill-accounts.cjs 2>&1 || echo "[render-start] backfill warning, continuing..."

# ── Start the Next.js server ───────────────────────────────────
# IMPORTANT: We use `next start` instead of `node .next/standalone/server.js`
# because `output: 'standalone'` was removed from next.config.ts.
# `next start` reads Prisma Client from node_modules/.prisma/client/
# directly — so the runtime regeneration above is what actually gets
# loaded. This eliminates the entire class of bugs where the standalone
# bundle keeps loading a stale SQLite client.
echo "[render-start] Starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec npx next start -p "$PORT" -H "$HOSTNAME"
