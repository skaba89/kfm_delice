#!/bin/bash
set -e

echo "[render-build] Starting build..."

# Set default DATABASE_URL for build time (SQLite)
export DATABASE_URL="${DATABASE_URL:-file:./data/kfm-delice.db}"
echo "[render-build] DATABASE_URL=$DATABASE_URL"

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

# Copy auto-seed script to standalone output
echo "[render-build] Copying seed script..."
mkdir -p .next/standalone/scripts
cp scripts/auto-seed.cjs .next/standalone/scripts/

echo "[render-build] Build complete!"
