#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# render-start.sh — Production-safe startup (Mission 5 — Phase 4)
# ───────────────────────────────────────────────────────────────────
# This script runs ONLY:
#   1. Production safety check (check-production-safety.cjs)
#   2. Select PostgreSQL schema
#   3. prisma generate
#   4. prisma validate
#   5. Provider verification
#   6. Build-output verification
#   7. Targeted QR migration repair + prisma migrate deploy
#   8. Read-only schema verification
#   9. next start
#
# It NEVER runs:
#   - prisma db push
#   - --accept-data-loss
#   - Auto-seed in production
#   - Generic migration auto-resolve
#
# Production invariant: a process MUST NOT start if migrations or schema
# verification fail. Render readiness is handled by /api/ready.
# ───────────────────────────────────────────────────────────────────

set -euo pipefail

echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting KFM Delice on Render..."
echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=${PORT:-3000} HOSTNAME=${HOSTNAME:-0.0.0.0}"
echo "[render-start] NODE_ENV=${NODE_ENV:-(not set)}"
echo "[render-start] APP_MODE=${APP_MODE:-(not set)}"
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[render-start] DATABASE_URL is set (value hidden for security)"
else
  echo "[render-start] DATABASE_URL is NOT SET"
fi
echo "[render-start] ─────────────────────────────────────────────"

detect_provider() {
  case "${DATABASE_URL:-}" in
    postgresql://*|postgres://*) echo "postgres" ;;
    file:*)                       echo "sqlite" ;;
    *)                            echo "unknown" ;;
  esac
}

if [ -z "${DATABASE_URL:-}" ]; then
  if [ "${NODE_ENV:-}" = "production" ] || [ "${APP_MODE:-}" = "production" ]; then
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

echo "[render-start] Step 1: Production safety check..."
node scripts/check-production-safety.cjs
echo "[render-start] ✓ Production safety check passed."

echo "[render-start] Step 2: Switching schema to $PROVIDER..."
if [ "$PROVIDER" = "postgres" ]; then
  cp prisma/schema.postgres.prisma prisma/schema.prisma
elif [ "$PROVIDER" = "sqlite" ]; then
  cp prisma/schema.sqlite.prisma prisma/schema.prisma
  mkdir -p data
fi

echo "[render-start] Step 3: Regenerating Prisma Client (provider=$PROVIDER)..."
test -d node_modules/@prisma/client || {
  echo "[render-start] FATAL: @prisma/client package missing from build artifact"
  exit 1
}
rm -rf node_modules/.prisma 2>/dev/null || true
node_modules/.bin/prisma generate
echo "[render-start] ✓ Prisma Client regenerated."

echo "[render-start] Step 4: Validating Prisma schema..."
node_modules/.bin/prisma validate
echo "[render-start] ✓ Schema is valid."

echo "[render-start] Step 5: Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs
echo "[render-start] ✓ Provider verification passed."

echo "[render-start] Step 6: Checking Next.js build output..."
test -d .next || { echo "[render-start] FATAL: .next directory missing"; exit 1; }
test -f .next/BUILD_ID || { echo "[render-start] FATAL: .next/BUILD_ID missing"; exit 1; }
test -x node_modules/.bin/next || { echo "[render-start] FATAL: next binary missing"; exit 1; }
test -x node_modules/.bin/prisma || { echo "[render-start] FATAL: prisma binary missing"; exit 1; }
test -d node_modules/@prisma/client || { echo "[render-start] FATAL: @prisma/client missing"; exit 1; }
test -d node_modules/.prisma/client || { echo "[render-start] FATAL: .prisma/client missing"; exit 1; }
echo "[render-start] ✓ Build output check complete."

echo "[render-start] Step 7: Repairing QR migration (if needed)..."
if [ "$PROVIDER" = "postgres" ]; then
  # Targeted compatibility repair only. A failure here is allowed because
  # prisma migrate deploy immediately below remains the authoritative gate.
  if ! node scripts/repair-qr-migration.cjs 2>&1; then
    echo "[render-start] WARNING: targeted QR repair failed; strict migrate deploy will decide startup."
  fi
fi

echo "[render-start] Step 7b: Running strict prisma migrate deploy..."
if ! node_modules/.bin/prisma migrate deploy 2>&1; then
  echo "[render-start] FATAL: prisma migrate deploy failed. Refusing to start an inconsistent application."
  exit 1
fi
echo "[render-start] ✓ Migrations applied."

echo "[render-start] Step 8: Read-only schema verification..."
if ! node scripts/verify-schema-read-only.cjs 2>&1; then
  echo "[render-start] FATAL: schema verification failed after migrations. Refusing to start."
  exit 1
fi
echo "[render-start] ✓ Schema verification complete."

echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting Next.js server on 0.0.0.0:${PORT:-3000}..."
echo "[render-start] Provider: $PROVIDER"
echo "[render-start] ─────────────────────────────────────────────"
export PORT="${PORT:-3000}"

exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
