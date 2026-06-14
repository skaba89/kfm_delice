#!/bin/bash
set -e

echo "[render-build] Starting build..."

# Fix DATABASE_URL if it doesn't start with 'file:' (SQLite requirement)
# Render dashboard might have set it incorrectly (e.g. a PostgreSQL URL)
if [ -z "$DATABASE_URL" ] || [[ ! "$DATABASE_URL" == file:* ]]; then
  export DATABASE_URL="file:./data/kfm-delice.db"
  echo "[render-build] DATABASE_URL was missing or invalid, fixed to: $DATABASE_URL"
else
  echo "[render-build] DATABASE_URL=$DATABASE_URL"
fi

# Create data directory
mkdir -p data

# Generate Prisma client
echo "[render-build] Generating Prisma client..."
npx prisma generate

# Build Next.js (standalone output for Render)
echo "[render-build] Building Next.js..."
next build

# Copy Prisma schema to standalone output (needed at runtime)
echo "[render-build] Copying Prisma files to standalone output..."
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/
cp -r node_modules/.prisma .next/standalone/node_modules/ 2>/dev/null || true

# Copy public assets to standalone output
echo "[render-build] Copying public assets..."
cp -r public .next/standalone/public 2>/dev/null || true

# Copy seed & schema scripts to standalone output
echo "[render-build] Copying scripts..."
mkdir -p .next/standalone/scripts
cp scripts/auto-seed.cjs .next/standalone/scripts/
cp scripts/ensure-schema.cjs .next/standalone/scripts/

# Also copy render-start.sh to standalone output
cp render-start.sh .next/standalone/render-start.sh 2>/dev/null || true

echo "[render-build] Build complete!"
