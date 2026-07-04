#!/bin/bash
set -e

echo "[render-build] Starting build..."
echo "[render-build] NODE_ENV=${NODE_ENV:-(not set)}"
if [ -n "$DATABASE_URL" ]; then
  echo "[render-build] DATABASE_URL is set (value hidden for security)"
else
  echo "[render-build] DATABASE_URL is NOT SET"
fi

# ── Determine which Prisma schema to use ──────────────────────
# SIMPLE LOGIC — no NODE_ENV dependency:
#   1. If DATABASE_URL starts with postgresql:// or postgres:// → PostgreSQL
#   2. If DATABASE_URL starts with file: → SQLite
#   3. If DATABASE_URL is NOT SET → PostgreSQL (Render production default)
#      (local dev should always have DATABASE_URL=file:... in .env)
#
# This ensures PostgreSQL is ALWAYS used on Render, even if NODE_ENV
# is not set at build time.
case "$DATABASE_URL" in
  postgresql://*|postgres://*)
    PROVIDER="postgres"
    ;;
  file:*)
    PROVIDER="sqlite"
    ;;
  "")
    # DATABASE_URL not set → assume PostgreSQL (Render production)
    # Local dev should have DATABASE_URL in .env
    PROVIDER="postgres"
    echo "[render-build] DATABASE_URL not set — defaulting to PostgreSQL (Render production)"
    export DATABASE_URL="postgresql://build:build@localhost:5432/build_db?schema=public"
    ;;
  *)
    echo "[render-build] FATAL: DATABASE_URL has unknown format"
    exit 1
    ;;
esac

echo "[render-build] Provider: $PROVIDER"

if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-build] Copying PostgreSQL schema..."
  cp prisma/schema.postgres.prisma prisma/schema.prisma
else
  echo "[render-build] Copying SQLite schema..."
  cp prisma/schema.sqlite.prisma prisma/schema.prisma
  mkdir -p data
fi

# ── Verify the schema provider ────────────────────────────────
echo "[render-build] Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs

# ── Generate Prisma client ────────────────────────────────────
# Delete cached client first to force regeneration.
echo "[render-build] Clearing cached Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client
echo "[render-build] Running prisma generate (provider=$PROVIDER)..."
npx prisma generate

# ── Build Next.js ─────────────────────────────────────────────
echo "[render-build] Building Next.js..."
next build

# ── Copy Prisma files to standalone output ────────────────────
echo "[render-build] Copying Prisma files to standalone output..."
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/
cp -r node_modules/.prisma .next/standalone/node_modules/ 2>/dev/null || true
rm -rf .next/standalone/node_modules/@prisma/client
mkdir -p .next/standalone/node_modules/@prisma
cp -r node_modules/@prisma/client .next/standalone/node_modules/@prisma/ 2>/dev/null || true

# ── Copy public assets ────────────────────────────────────────
echo "[render-build] Copying public assets..."
cp -r public .next/standalone/public 2>/dev/null || true

# ── Copy scripts needed at runtime ────────────────────────────
echo "[render-build] Copying runtime scripts..."
mkdir -p .next/standalone/scripts
cp scripts/auto-seed.cjs .next/standalone/scripts/ 2>/dev/null || true
cp scripts/ensure-postgres-columns.cjs .next/standalone/scripts/ 2>/dev/null || true
cp scripts/check-prisma-provider.cjs .next/standalone/scripts/ 2>/dev/null || true
cp scripts/backfill-accounts.cjs .next/standalone/scripts/ 2>/dev/null || true

# ── Copy render-start.sh ──────────────────────────────────────
cp render-start.sh .next/standalone/render-start.sh 2>/dev/null || true

echo "[render-build] Build complete! Provider=$PROVIDER"
