#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"

# Create data directory for SQLite
mkdir -p data

# Set DATABASE_URL if not already set
export DATABASE_URL="${DATABASE_URL:-file:./data/kfm-delice.db}"
echo "[render-start] DATABASE_URL=$DATABASE_URL"

# Generate Prisma client and push schema
echo "[render-start] Generating Prisma client..."
npx prisma generate 2>&1 || echo "[render-start] prisma generate warning"

echo "[render-start] Pushing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[render-start] prisma db push warning"

# Seed if empty (using simple node check)
echo "[render-start] Checking if database needs seeding..."
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.restaurant.count().then(async c => {
  console.log('[seed-check] Restaurants in DB: ' + c);
  if (c === 0) {
    console.log('[seed-check] Seeding database...');
    try {
      const { execSync } = require('child_process');
      execSync('npx tsx prisma/seed.ts --reset', { stdio: 'inherit', timeout: 60000 });
      console.log('[seed-check] Seed complete.');
    } catch(e) {
      console.log('[seed-check] Seed error (non-fatal): ' + e.message);
    }
  }
  await p.\$disconnect();
}).catch(async e => {
  console.log('[seed-check] DB check error: ' + e.message);
  await p.\$disconnect();
});
" || echo "[render-start] Seed check had issues, continuing..."

# Start the Next.js standalone server
echo "[render-start] Starting Next.js server..."
export HOSTNAME="0.0.0.0"
exec node .next/standalone/server.js
