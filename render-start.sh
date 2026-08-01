#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# render-start.sh — Production-safe startup (Mission 5 — Phase 4)
# ───────────────────────────────────────────────────────────────────
# This script runs ONLY:
#   1. Production safety check (check-production-safety.cjs)
#   2. Select PostgreSQL schema
#   3. prisma generate (only if needed)
#   4. prisma validate
#   5. Provider verification
#   6. Read-only verification of QR migration state
#   7. prisma migrate deploy
#   8. Read-only verification after migration
#   9. next start
#
# It NEVER runs:
#   - prisma db push (destructive — can drop columns)
#   - ALTER TABLE / CREATE TABLE scripts (except in repair-qr-migration.cjs
#     which uses conditional IF NOT EXISTS / DO $$ blocks)
#   - Auto-seed (creates demo accounts with known credentials)
#   - Backfill scripts
#   - --accept-data-loss
#   - Generic auto-resolve of ALL failed migrations
#
# Any error is FATAL and stops the deployment (set -euo pipefail).
# ───────────────────────────────────────────────────────────────────

set -euo pipefail

echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting KFM Delice on Render..."
echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=${PORT:-3000} HOSTNAME=$HOSTNAME"
echo "[render-start] NODE_ENV=${NODE_ENV:-(not set)}"
echo "[render-start] APP_MODE=${APP_MODE:-(not set)}"
if [ -n "$DATABASE_URL" ]; then
  echo "[render-start] DATABASE_URL is set (value hidden for security)"
else
  echo "[render-start] DATABASE_URL is NOT SET"
fi
echo "[render-start] ─────────────────────────────────────────────"

# ── Step 0: Detect database provider ──
detect_provider() {
  case "$DATABASE_URL" in
    postgresql://*|postgres://*) echo "postgres" ;;
    file:*)                       echo "sqlite" ;;
    *)                            echo "unknown" ;;
  esac
}

if [ -z "$DATABASE_URL" ]; then
  if [ "$NODE_ENV" = "production" ] || [ "$APP_MODE" = "production" ]; then
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

# ── Step 1: Production safety check (must run BEFORE anything else) ──
echo "[render-start] Step 1: Production safety check..."
node scripts/check-production-safety.cjs
echo "[render-start] ✓ Production safety check passed."

# ── Step 2: Switch schema to the correct provider ──
echo "[render-start] Step 2: Switching schema to $PROVIDER..."
if [ "$PROVIDER" = "postgres" ]; then
  cp prisma/schema.postgres.prisma prisma/schema.prisma
elif [ "$PROVIDER" = "sqlite" ]; then
  cp prisma/schema.sqlite.prisma prisma/schema.prisma
  mkdir -p data
fi

# ── Step 3: Regenerate Prisma Client for the active provider ──
echo "[render-start] Step 3: Regenerating Prisma Client (provider=$PROVIDER)..."
rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true
node_modules/.bin/prisma generate
echo "[render-start] ✓ Prisma Client regenerated."

# ── Step 4: Validate the schema ──
echo "[render-start] Step 4: Validating Prisma schema..."
node_modules/.bin/prisma validate
echo "[render-start] ✓ Schema is valid."

# ── Step 5: Verify the generated client matches the expected provider ──
echo "[render-start] Step 5: Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs
echo "[render-start] ✓ Provider verification passed."

# ── Step 6: Verify build output ──
echo "[render-start] Step 6: Checking Next.js build output..."
test -d .next || { echo "[render-start] FATAL: .next directory missing"; exit 1; }
test -f .next/BUILD_ID || { echo "[render-start] FATAL: .next/BUILD_ID missing"; exit 1; }
test -x node_modules/.bin/next || { echo "[render-start] FATAL: next binary missing"; exit 1; }
test -x node_modules/.bin/prisma || { echo "[render-start] FATAL: prisma binary missing"; exit 1; }
test -d node_modules/@prisma/client || { echo "[render-start] FATAL: @prisma/client missing"; exit 1; }
test -d node_modules/.prisma/client || { echo "[render-start] FATAL: .prisma/client missing"; exit 1; }
echo "[render-start] ✓ Build output check complete."

# ── Step 7: Repair QR migration (targeted, NOT generic) then migrate deploy ──
echo "[render-start] Step 7: Repairing QR migration (if needed)..."
if [ "$PROVIDER" = "postgres" ]; then
  # This script:
  #   - Verifies the QR migration objects (read-only)
  #   - If all exist (chemin A): marks as applied via `prisma migrate resolve --applied`
  #   - If some missing (chemin B): creates them with conditional SQL, then marks as applied
  #   - ONLY targets 20260713000000_add_restaurant_table_qr
  #   - Refuses to touch any other migration
  node scripts/repair-qr-migration.cjs
  echo "[render-start] ✓ QR migration repair complete."
fi

echo "[render-start] Step 7b: Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy
echo "[render-start] ✓ Migrations applied."

# ── Step 8: Read-only schema verification after migration ──
echo "[render-start] Step 8: Read-only schema verification..."
node scripts/verify-schema-read-only.cjs
echo "[render-start] ✓ Schema verification complete."

# ── Step 9: Start the Next.js server ──
echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting Next.js server on 0.0.0.0:${PORT:-3000}..."
echo "[render-start] Provider: $PROVIDER"
echo "[render-start] ─────────────────────────────────────────────"
export PORT="${PORT:-3000}"

exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
