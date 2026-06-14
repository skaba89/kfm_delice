#!/bin/bash
set -e

echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"

# Fix DATABASE_URL if it doesn't start with 'file:' (SQLite requirement)
# Render dashboard might have set it incorrectly
if [ -z "$DATABASE_URL" ] || [[ ! "$DATABASE_URL" == file:* ]]; then
  export DATABASE_URL="file:./data/kfm-delice.db"
  echo "[render-start] DATABASE_URL was missing or invalid, fixed to: $DATABASE_URL"
else
  echo "[render-start] DATABASE_URL=$DATABASE_URL"
fi

# Create data directory for SQLite
mkdir -p data

# Push database schema (creates tables if missing)
echo "[render-start] Pushing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[render-start] prisma db push warning"

# Force-add missing columns that prisma db push might miss
# This handles the case where the DB was created with an older schema
echo "[render-start] Ensuring all columns exist..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fix() {
  try {
    // Add mustChangePassword column to Admin if missing
    await prisma.\$executeRawUnsafe('ALTER TABLE Admin ADD COLUMN mustChangePassword BOOLEAN NOT NULL DEFAULT 0');
    console.log('[fix] Added mustChangePassword to Admin');
  } catch(e) { if(e.message.includes('duplicate column')) console.log('[fix] mustChangePassword already exists'); else console.log('[fix] Admin column check:', e.message); }
  try {
    // Add mustChangePassword column to Customer if missing
    await prisma.\$executeRawUnsafe('ALTER TABLE Customer ADD COLUMN mustChangePassword BOOLEAN NOT NULL DEFAULT 0');
    console.log('[fix] Added mustChangePassword to Customer');
  } catch(e) { if(e.message.includes('duplicate column')) console.log('[fix] mustChangePassword already exists in Customer'); else console.log('[fix] Customer column check:', e.message); }
  try {
    // Add mustChangePassword column to Driver if missing
    await prisma.\$executeRawUnsafe('ALTER TABLE Driver ADD COLUMN mustChangePassword BOOLEAN NOT NULL DEFAULT 0');
    console.log('[fix] Added mustChangePassword to Driver');
  } catch(e) { if(e.message.includes('duplicate column')) console.log('[fix] mustChangePassword already exists in Driver'); else console.log('[fix] Driver column check:', e.message); }
  await prisma.\$disconnect();
}
fix();
" 2>&1 || echo "[render-start] Column fix warning, continuing..."

# Seed if empty
echo "[render-start] Checking if database needs seeding..."
node scripts/auto-seed.cjs || echo "[render-start] Auto-seed warning, continuing..."

# Start the Next.js standalone server
echo "[render-start] Starting Next.js server..."
export HOSTNAME="0.0.0.0"
exec node .next/standalone/server.js
