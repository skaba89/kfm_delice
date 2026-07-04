#!/bin/bash
set -e

echo "[render-build] Starting build..."
echo "[render-build] NODE_ENV=$NODE_ENV"
echo "[render-build] DATABASE_URL is ${DATABASE_URL:+set}${DATABASE_URL:-NOT SET}"

# ── Detect database provider from DATABASE_URL ─────────────────
# Render injects DATABASE_URL at build time when a database resource is
# attached. On some Render plans (free tier), DATABASE_URL may NOT be
# available at build time — only at runtime. In that case, we DEFAULT
# TO POSTGRESQL (the production target), NOT SQLite.
#
# Why PostgreSQL default? If DATABASE_URL is missing at build time:
#   - On Render (production): DATABASE_URL will be injected at runtime as
#     postgresql://...  → we MUST generate a PostgreSQL Prisma Client
#   - In local dev: the developer should have DATABASE_URL=file:... in
#     their .env file → DATABASE_URL won't be missing
#
# So "DATABASE_URL missing" almost always means "Render build time" →
# default to PostgreSQL. The only way to get SQLite is to explicitly
# set DATABASE_URL=file:... (local dev).
detect_provider() {
  case "$DATABASE_URL" in
    postgresql://*|postgres://*)
      echo "postgres"
      ;;
    file:*)
      echo "sqlite"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

if [ -z "$DATABASE_URL" ]; then
  # DATABASE_URL is NOT set at build time → default to PostgreSQL.
  # This is the Render scenario: DATABASE_URL will be injected at runtime.
  # Using SQLite here would generate a Prisma Client hardcoded for SQLite
  # that refuses PostgreSQL URLs at runtime → all DB queries crash with
  # "the URL must start with the protocol file:".
  echo "[render-build] DATABASE_URL not set at build time — defaulting to PostgreSQL schema."
  echo "[render-build] (DATABASE_URL will be injected at runtime by Render)"
  PROVIDER="postgres"
else
  PROVIDER=$(detect_provider)
fi

echo "[render-build] Detected provider: $PROVIDER"
# Log only the provider + first 40 chars (no credentials leaked in build logs).
if [ -n "$DATABASE_URL" ]; then
  echo "[render-build] DATABASE_URL prefix: ${DATABASE_URL:0:40}..."
else
  echo "[render-build] DATABASE_URL: (not set — will use runtime injection)"
fi

if [ "$PROVIDER" = "unknown" ]; then
  echo "[render-build] FATAL: DATABASE_URL must start with 'file:', 'postgresql://' or 'postgres://'."
  exit 1
fi

# ── Switch schema based on provider ────────────────────────────
if [ "$PROVIDER" = "postgres" ]; then
  if [ -f "prisma/schema.postgres.prisma" ]; then
    echo "[render-build] Switching to PostgreSQL schema..."
    cp prisma/schema.postgres.prisma prisma/schema.prisma
  else
    echo "[render-build] WARNING: prisma/schema.postgres.prisma not found — using whatever is in schema.prisma"
  fi
else
  if [ -f "prisma/schema.sqlite.prisma" ]; then
    echo "[render-build] Switching to SQLite schema..."
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
  fi
  mkdir -p data
fi

# ── Generate Prisma client ─────────────────────────────────────
# This MUST run AFTER the schema switch above so the client is generated
# with the correct provider (postgresql or sqlite).
echo "[render-build] Generating Prisma client with provider=$PROVIDER..."
npx prisma generate

# ── Build Next.js (standalone output for Render) ───────────────
echo "[render-build] Building Next.js..."
next build

# ── Copy Prisma schema to standalone output (runtime needs it) ──
echo "[render-build] Copying Prisma files to standalone output..."
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/
cp -r node_modules/.prisma .next/standalone/node_modules/ 2>/dev/null || true

# ── Copy public assets ─────────────────────────────────────────
echo "[render-build] Copying public assets..."
cp -r public .next/standalone/public 2>/dev/null || true

# ── Copy scripts needed at runtime ─────────────────────────────
echo "[render-build] Copying runtime scripts..."
mkdir -p .next/standalone/scripts
cp scripts/auto-seed.cjs .next/standalone/scripts/ 2>/dev/null || true
cp scripts/ensure-postgres-columns.cjs .next/standalone/scripts/ 2>/dev/null || true

# ── Copy render-start.sh to standalone output ──────────────────
cp render-start.sh .next/standalone/render-start.sh 2>/dev/null || true

echo "[render-build] Build complete! Provider=$PROVIDER"
