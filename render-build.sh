#!/bin/bash
set -e

echo "[render-build] Starting build..."
echo "[render-build] NODE_ENV=${NODE_ENV:-(not set)}"
echo "[render-build] DATABASE_URL is ${DATABASE_URL:+set}${DATABASE_URL:-NOT SET}"

# ── Determine which Prisma schema to use ──────────────────────
# Production (Render) ALWAYS uses PostgreSQL. The DATABASE_URL may
# not be available at build time on Render free tier, so we detect
# production via NODE_ENV and force PostgreSQL schema + a temporary
# fake DATABASE_URL just so `prisma generate` and `next build` succeed.
#
# Local dev uses whatever DATABASE_URL is set (typically file:... for
# SQLite, but can be postgresql:// for local Postgres testing).
if [ "$NODE_ENV" = "production" ]; then
  echo "[render-build] NODE_ENV=production → forcing PostgreSQL schema"
  cp prisma/schema.postgres.prisma prisma/schema.prisma

  # prisma generate needs a DATABASE_URL to validate the datasource,
  # even though it doesn't connect. Use a fake PostgreSQL URL if the
  # real one isn't available at build time.
  if [ -z "$DATABASE_URL" ]; then
    echo "[render-build] DATABASE_URL missing during build — using temporary PostgreSQL URL for Prisma generate only"
    export DATABASE_URL="postgresql://build:build@localhost:5432/build_db?schema=public"
  fi
else
  # Local dev: use SQLite if DATABASE_URL not set or is file:...
  if [ -z "$DATABASE_URL" ]; then
    echo "[render-build] DATABASE_URL not set — defaulting to SQLite for local dev"
    export DATABASE_URL="file:./data/kfm-delice.db"
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
  elif [[ "$DATABASE_URL" == postgresql://* ]] || [[ "$DATABASE_URL" == postgres://* ]]; then
    echo "[render-build] DATABASE_URL is PostgreSQL — using PostgreSQL schema"
    cp prisma/schema.postgres.prisma prisma/schema.prisma
  else
    echo "[render-build] DATABASE_URL is SQLite — using SQLite schema"
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
  fi
  mkdir -p data
fi

# ── Verify the schema provider matches expectations ───────────
echo "[render-build] Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs

# ── Generate Prisma client ────────────────────────────────────
# Delete cached client first to force regeneration.
echo "[render-build] Clearing cached Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client
echo "[render-build] Running prisma generate..."
npx prisma generate

# ── Build Next.js (standalone output for Render) ──────────────
echo "[render-build] Building Next.js..."
next build

# ── Copy Prisma files to standalone output ────────────────────
# The standalone server (.next/standalone/server.js) loads modules
# from .next/standalone/node_modules/, so we must copy the generated
# Prisma client there.
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

# ── Copy render-start.sh to standalone output ─────────────────
cp render-start.sh .next/standalone/render-start.sh 2>/dev/null || true

echo "[render-build] Build complete!"
