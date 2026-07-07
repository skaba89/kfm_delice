#!/bin/bash
# IMPORTANT: NO 'set -e' here — we want the server to start even if
# individual steps (migrate, seed, backfill) fail. The previous version
# had 'set -e' which made the whole script abort on any error, leaving
# the service in a broken state.

echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting KFM Delice on Render..."
echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=${PORT:-3000} HOSTNAME=$HOSTNAME"
echo "[render-start] NODE_ENV=${NODE_ENV:-(not set)}"
if [ -n "$DATABASE_URL" ]; then
  echo "[render-start] DATABASE_URL is set (value hidden for security)"
else
  echo "[render-start] DATABASE_URL is NOT SET"
fi
echo "[render-start] ─────────────────────────────────────────────"

# ── Detect database provider from DATABASE_URL ────────────────
detect_provider() {
  case "$DATABASE_URL" in
    postgresql://*|postgres://*) echo "postgres" ;;
    file:*)                       echo "sqlite" ;;
    *)                            echo "unknown" ;;
  esac
}

if [ -z "$DATABASE_URL" ]; then
  if [ "$NODE_ENV" = "production" ]; then
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

# ── Switch schema to match the actual DATABASE_URL ────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Switching schema to PostgreSQL..."
  cp prisma/schema.postgres.prisma prisma/schema.prisma || echo "[render-start] WARNING: could not copy postgres schema"
elif [ "$PROVIDER" = "sqlite" ]; then
  echo "[render-start] Switching schema to SQLite..."
  cp prisma/schema.sqlite.prisma prisma/schema.prisma || echo "[render-start] WARNING: could not copy sqlite schema"
  mkdir -p data
fi

# ── Regenerate Prisma Client at RUNTIME ───────────────────────
# Use node_modules/.bin/prisma (NOT npx prisma) to avoid downloading Prisma 7+
echo "[render-start] Clearing cached Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true

echo "[render-start] Regenerating Prisma Client (provider=$PROVIDER)..."
if [ -x node_modules/.bin/prisma ]; then
  node_modules/.bin/prisma generate 2>&1 || echo "[render-start] WARNING: prisma generate failed (will try to start anyway)"
else
  echo "[render-start] WARNING: node_modules/.bin/prisma not found, trying npx prisma@6"
  npx prisma@6 generate 2>&1 || echo "[render-start] WARNING: npx prisma generate also failed"
fi

# ── Verify the generated client matches the expected provider ──
# (warning only — don't abort if it fails)
echo "[render-start] Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs 2>&1 || echo "[render-start] WARNING: provider verification failed (continuing anyway)"

# ── Diagnostics ────────────────────────────────────────────────
echo "[render-start] Checking Next.js build output..."
test -d .next || echo "[render-start] WARNING: .next directory missing"
test -f .next/BUILD_ID || echo "[render-start] WARNING: .next/BUILD_ID missing"
test -d node_modules/@prisma/client || echo "[render-start] WARNING: @prisma/client missing"
test -d node_modules/.prisma/client || echo "[render-start] WARNING: .prisma/client missing"

# ── Apply schema & migrations (non-fatal on failure) ──────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Running prisma migrate deploy..."
  node_modules/.bin/prisma migrate deploy 2>&1 || {
    echo "[render-start] ⚠️  prisma migrate deploy failed — falling back to db push"
    node_modules/.bin/prisma db push --skip-generate 2>&1 || echo "[render-start] ⚠️  prisma db push also failed"
  }

  echo "[render-start] Running ensure-postgres-columns safety check..."
  node scripts/ensure-postgres-columns.cjs 2>&1 || echo "[render-start] ensure-columns warning, continuing..."
else
  echo "[render-start] Pushing SQLite schema..."
  node_modules/.bin/prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
fi

# ── Seed (non-fatal) ──────────────────────────────────────────
echo "[render-start] Running auto-seed..."
node scripts/auto-seed.cjs 2>&1 || echo "[render-start] Auto-seed warning, continuing..."

# ── Backfill (non-fatal) ──────────────────────────────────────
echo "[render-start] Running SaaS account backfill..."
node scripts/backfill-accounts.cjs 2>&1 || echo "[render-start] backfill warning, continuing..."

# ── Start the Next.js server ───────────────────────────────────
# IMPORTANT: Listen on 0.0.0.0 so Render's load balancer can route traffic.
# Render sets HOSTNAME to the Kubernetes pod name (e.g. srv-xxx-hibernate-yyy)
# which is NOT reachable from outside the pod — using it causes 502.
echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting Next.js server on 0.0.0.0:${PORT:-3000}..."
echo "[render-start] Provider: $PROVIDER"
echo "[render-start] (Listening on 0.0.0.0 so Render can route traffic)"
echo "[render-start] ─────────────────────────────────────────────"
export PORT="${PORT:-3000}"

# Use node_modules/.bin/next directly (not npx next) for consistency
# and to avoid any npx download behavior.
exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
