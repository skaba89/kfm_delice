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
# The build may have cached a stale Prisma Client. We regenerate it
# at runtime to ensure it matches the actual DATABASE_URL provider.
# This is the definitive fix for the "URL must start with file:" error.
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

# Regenerate Prisma Client at RUNTIME to bypass any build cache.
echo "[render-start] Regenerating Prisma Client (provider=$PROVIDER)..."
rm -rf node_modules/.prisma node_modules/@prisma/client
npx prisma generate 2>&1 || echo "[render-start] WARNING: prisma generate failed"

# Copy regenerated client to standalone output (server.js loads from there).
echo "[render-start] Copying regenerated Prisma Client to standalone..."
rm -rf .next/standalone/node_modules/.prisma
cp -r node_modules/.prisma .next/standalone/node_modules/ 2>/dev/null || echo "[render-start] WARNING: could not copy .prisma to standalone"
rm -rf .next/standalone/node_modules/@prisma/client
mkdir -p .next/standalone/node_modules/@prisma
cp -r node_modules/@prisma/client .next/standalone/node_modules/@prisma/ 2>/dev/null || echo "[render-start] WARNING: could not copy @prisma/client to standalone"
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/ 2>/dev/null || true

# ── Apply schema & migrations ──────────────────────────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Running prisma migrate deploy..."
  if ! npx prisma migrate deploy 2>&1; then
    echo "[render-start] ⚠️  prisma migrate deploy failed — falling back to db push (NO --accept-data-loss)"
    npx prisma db push --skip-generate 2>&1 || echo "[render-start] ⚠️  prisma db push also failed"
  fi

  # Safety net: ensure critical columns/tables exist
  echo "[render-start] Running ensure-postgres-columns safety check..."
  node scripts/ensure-postgres-columns.cjs 2>&1 || echo "[render-start] ensure-columns warning, continuing..."
else
  echo "[render-start] Pushing SQLite schema..."
  npx prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
fi

# ── Seed if empty ──────────────────────────────────────────────
echo "[render-start] Checking if database needs seeding..."
node scripts/auto-seed.cjs 2>&1 || echo "[render-start] Auto-seed warning, continuing..."

# ── Start the Next.js standalone server ────────────────────────
echo "[render-start] Starting Next.js server on $HOSTNAME:$PORT..."
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec node .next/standalone/server.js
