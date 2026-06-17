#!/bin/bash
set -e

echo "[render-build] Starting build..."

# ── Detect database provider from DATABASE_URL ─────────────────
detect_provider() {
  case "$DATABASE_URL" in
    postgresql://*|postgres://*)
      echo "postgres"
      ;;
    file:*)
      echo "sqlite"
      ;;
    "")
      echo "sqlite"
      export DATABASE_URL="file:./data/kfm-delice.db"
      ;;
    *)
      echo "sqlite"
      export DATABASE_URL="file:./data/kfm-delice.db"
      ;;
  esac
}

PROVIDER=$(detect_provider)
echo "[render-build] Detected provider: $PROVIDER"
echo "[render-build] DATABASE_URL=${DATABASE_URL:0:40}..."

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
echo "[render-build] Generating Prisma client..."
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
echo "[render-build] Copying seed script..."
mkdir -p .next/standalone/scripts
cp scripts/auto-seed.cjs .next/standalone/scripts/ 2>/dev/null || true

# ── Copy render-start.sh to standalone output ──────────────────
cp render-start.sh .next/standalone/render-start.sh 2>/dev/null || true

echo "[render-build] Build complete! Provider=$PROVIDER"
