#!/bin/bash
set -e

echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting KFM Delice on Render..."
echo "[render-start] Current directory: $(pwd)"
echo "[render-start] PORT=$PORT HOSTNAME=$HOSTNAME"
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
  cp prisma/schema.postgres.prisma prisma/schema.prisma
elif [ "$PROVIDER" = "sqlite" ]; then
  echo "[render-start] Switching schema to SQLite..."
  cp prisma/schema.sqlite.prisma prisma/schema.prisma
  mkdir -p data
fi

# ── Regenerate Prisma Client at RUNTIME ───────────────────────
# This is the most important step. Even though render-build.sh
# generated the client with the correct provider, we regenerate it
# again here to be 100% sure it matches the actual runtime DATABASE_URL.
# (Render's build-time DATABASE_URL may differ from runtime DATABASE_URL.)
echo "[render-start] Clearing cached Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client

echo "[render-start] Regenerating Prisma Client (provider=$PROVIDER)..."
# Use node_modules/.bin/prisma (NOT npx prisma) — npx may download Prisma 7+
# which has breaking changes (datasource url no longer supported in schema).
# We must use the version pinned in package.json (6.x).
if [ -x node_modules/.bin/prisma ]; then
  node_modules/.bin/prisma generate 2>&1 || {
    echo "[render-start] FATAL: prisma generate failed. Cannot start with a broken client."
    exit 1
  }
else
  echo "[render-start] WARNING: node_modules/.bin/prisma not found, falling back to npx"
  npx --no-install prisma generate 2>&1 || npx prisma@6 generate 2>&1 || {
    echo "[render-start] FATAL: prisma generate failed. Cannot start with a broken client."
    exit 1
  }
fi

# ── CRITICAL: Verify the generated client matches the expected provider ──
# This is the guard that FINALLY kills the "URL must start with file:" error.
# If the generated client has the wrong provider, we refuse to start —
# better to fail loudly than to serve 500s on every request.
echo "[render-start] Verifying Prisma provider (schema + generated client)..."
node scripts/check-prisma-provider.cjs || {
  echo "[render-start] ─────────────────────────────────────────────"
  echo "[render-start] FATAL: Prisma Client provider mismatch!"
  echo "[render-start] The generated client does not match DATABASE_URL."
  echo "[render-start] Expected provider: $PROVIDER"
  echo "[render-start] Refusing to start to avoid serving 500 errors."
  echo "[render-start] ─────────────────────────────────────────────"
  exit 1
}

# ── Diagnostics: verify build output BEFORE starting server ────
echo "[render-start] Checking Next.js build output..."
test -d .next || echo "[render-start] WARNING: .next directory missing"
test -f .next/BUILD_ID || echo "[render-start] WARNING: .next/BUILD_ID missing"
test -d node_modules || echo "[render-start] WARNING: node_modules missing"
test -d node_modules/@prisma/client || echo "[render-start] WARNING: @prisma/client missing"
test -d node_modules/.prisma/client || echo "[render-start] WARNING: .prisma/client missing"
echo "[render-start] Build output check complete."

# ── Apply schema & migrations ──────────────────────────────────
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-start] Running prisma migrate deploy..."
  if ! node_modules/.bin/prisma migrate deploy 2>&1; then
    echo "[render-start] ⚠️  prisma migrate deploy failed — falling back to db push (NO --accept-data-loss)"
    node_modules/.bin/prisma db push --skip-generate 2>&1 || echo "[render-start] ⚠️  prisma db push also failed"
  fi

  # Safety net: ensure critical columns/tables exist (in case migrate
  # was incomplete or schema drift happened).
  echo "[render-start] Running ensure-postgres-columns safety check..."
  node scripts/ensure-postgres-columns.cjs 2>&1 || echo "[render-start] ensure-columns warning, continuing..."
else
  echo "[render-start] Pushing SQLite schema..."
  node_modules/.bin/prisma db push --skip-generate 2>&1 || echo "[render-start] prisma db push warning"
fi

# ── Seed FIRST (creates demo data on empty DB) ─────────────────
echo "[render-start] Running auto-seed..."
node scripts/auto-seed.cjs 2>&1 || echo "[render-start] Auto-seed warning, continuing..."

# ── Backfill SECOND (attaches Account to seed data) ────────────
echo "[render-start] Running SaaS account backfill..."
node scripts/backfill-accounts.cjs 2>&1 || echo "[render-start] backfill warning, continuing..."

# ── Start the Next.js server ───────────────────────────────────
# IMPORTANT: Render needs the server to listen on 0.0.0.0 (all interfaces)
# so its load balancer can route traffic to it. If we use the HOSTNAME
# env var that Render sets (which is the Kubernetes pod name like
# 'srv-xxx-hibernate-yyy'), Next.js will only listen on that specific
# interface and Render's health check will fail with 502.
# So we ALWAYS use 0.0.0.0 regardless of what HOSTNAME is set to.
echo "[render-start] ─────────────────────────────────────────────"
echo "[render-start] Starting Next.js server on 0.0.0.0:${PORT:-3000}..."
echo "[render-start] Provider: $PROVIDER"
echo "[render-start] (Listening on 0.0.0.0 so Render can route traffic)"
echo "[render-start] ─────────────────────────────────────────────"
export PORT="${PORT:-3000}"
# Do NOT export HOSTNAME — we pass 0.0.0.0 directly to next start
exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
