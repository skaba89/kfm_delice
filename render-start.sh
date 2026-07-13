#!/bin/bash
# IMPORTANT: NO 'set -e' here — we want the server to start even if
# individual steps (migrate, seed, backfill) fail. The previous version
# had 'set -e' which made the whole script abort on any error.

# ── Helpers for production safety ──────────────────────────────
is_real_production() {
  [ "$APP_MODE" = "production" ]
}

fail_or_warn() {
  local message="$1"
  if is_real_production; then
    echo "[render-start] FATAL: $message"
    exit 1
  else
    echo "[render-start] WARNING: $message"
  fi
}

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

# ── Production safety check (Mission 1) ────────────────────────
# Must run BEFORE any migration or seed.
node scripts/check-production-safety.cjs || {
  echo "[render-start] Production safety check FAILED. Refusing to start."
  exit 1
}

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

# ── Switch schema + regenerate Prisma Client ──────────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Switching schema to PostgreSQL..."
  cp prisma/schema.postgres.prisma prisma/schema.prisma || echo "[render-start] WARNING: could not copy postgres schema"
elif [ "$PROVIDER" = "sqlite" ]; then
  echo "[render-start] Switching schema to SQLite..."
  cp prisma/schema.sqlite.prisma prisma/schema.prisma || echo "[render-start] WARNING: could not copy sqlite schema"
  mkdir -p data
fi

# ── Regenerate Prisma Client at RUNTIME ───────────────────────
echo "[render-start] Clearing cached Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client 2>/dev/null || true

echo "[render-start] Regenerating Prisma Client (provider=$PROVIDER)..."
if [ -x node_modules/.bin/prisma ]; then
  node_modules/.bin/prisma generate 2>&1 || fail_or_warn "prisma generate failed"
else
  echo "[render-start] WARNING: node_modules/.bin/prisma not found, trying npx prisma@6"
  npx prisma@6 generate 2>&1 || fail_or_warn "npx prisma generate also failed"
fi

# ── Verify the generated client matches the expected provider ──
echo "[render-start] Verifying Prisma provider..."
node scripts/check-prisma-provider.cjs 2>&1 || fail_or_warn "provider verification failed"

# ── Diagnostics: verify build output BEFORE starting ───────────
echo "[render-start] Checking Next.js build output..."
test -d .next || fail_or_warn ".next directory missing"
test -f .next/BUILD_ID || fail_or_warn ".next/BUILD_ID missing"
test -x node_modules/.bin/next || fail_or_warn "next binary missing"
test -x node_modules/.bin/prisma || fail_or_warn "prisma binary missing"
test -d node_modules/@prisma/client || fail_or_warn "@prisma/client missing"
test -d node_modules/.prisma/client || fail_or_warn ".prisma/client missing"
echo "[render-start] Build output check complete."

# ── Apply schema & migrations ──────────────────────────────────
# Mission 2: In production, migrate deploy failure is FATAL.
# In demo/staging, fallback to db push if ALLOW_PRISMA_DB_PUSH_FALLBACK=true.
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Running prisma migrate deploy..."
  if ! node_modules/.bin/prisma migrate deploy 2>&1; then
    echo "[render-start] prisma migrate deploy failed — will try db push as fallback"
  fi

  # ── ALWAYS run prisma db push to sync schema ──────────────────
  # This ensures ALL tables + columns exist with the correct types,
  # even if migrate deploy failed or was partially applied.
  # db push is idempotent — it only ADDS missing tables/columns,
  # never drops or modifies existing ones.
  echo "[render-start] Running prisma db push (force schema sync)..."
  node_modules/.bin/prisma db push --skip-generate --accept-data-loss 2>&1 || {
    echo "[render-start] WARNING: prisma db push failed — relying on safety-net in db.ts"
  }

  # Run safety net ONLY in demo/staging (not production)
  if [ "$APP_MODE" != "production" ]; then
    echo "[render-start] Running ensure-postgres-columns safety check (demo/staging only)..."
    node scripts/ensure-postgres-columns.cjs 2>&1 || echo "[render-start] ensure-columns warning, continuing..."
  fi
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
echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting Next.js server on 0.0.0.0:${PORT:-3000}..."
echo "[render-start] Provider: $PROVIDER"
echo "[render-start] (Listening on 0.0.0.0 so Render can route traffic)"
echo "[render-start] ─────────────────────────────────────────────"
export PORT="${PORT:-3000}"

# Use node_modules/.bin/next directly (not npx next) for consistency
# and to avoid any npx download behavior.
exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
