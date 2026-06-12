#!/bin/bash
set -e

echo "[render-start] Initializing database..."
export DATABASE_URL="file:./data/kfm-delice.db"
mkdir -p data

# Push schema to create tables
npx prisma db push --skip-generate 2>&1 || true

# Seed if empty
echo "[render-start] Seeding database if needed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.restaurant.count().then(c => {
  if (c === 0) {
    console.log('[render-start] No restaurants found, running seed...');
    const { execSync } = require('child_process');
    try { execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' }); } catch(e) { console.log('[render-start] Seed attempted'); }
  } else {
    console.log('[render-start] Database already has ' + c + ' restaurants, skipping seed.');
  }
  prisma.\$disconnect();
}).catch(e => {
  console.error('[render-start] DB check error:', e.message);
  prisma.\$disconnect();
});
"

echo "[render-start] Starting server on port $PORT..."
export HOSTNAME="0.0.0.0"
exec node .next/standalone/server.js
