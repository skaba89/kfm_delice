#!/bin/bash
set -e

echo "[render-build] Starting build..."
echo "[render-build] NODE_ENV=${NODE_ENV:-(not set)}"
echo "[render-build] PWD=$(pwd)"
if [ -n "$DATABASE_URL" ]; then
  echo "[render-build] DATABASE_URL is set (value hidden for security)"
else
  echo "[render-build] DATABASE_URL is NOT SET"
fi

# ── Determine which Prisma schema to use ──────────────────────
case "$DATABASE_URL" in
  postgresql://*|postgres://*)
    PROVIDER="postgres"
    ;;
  file:*)
    PROVIDER="sqlite"
    ;;
  "")
    # DATABASE_URL not set at build time → assume PostgreSQL (Render production)
    # Render injects DATABASE_URL at runtime, but NOT necessarily at build time.
    # We MUST default to PostgreSQL so the build generates the correct Prisma Client.
    PROVIDER="postgres"
    echo "[render-build] DATABASE_URL not set at build time — defaulting to PostgreSQL"
    echo "[render-build] (Render injects DATABASE_URL at runtime; this is normal)"
    ;;
  *)
    echo "[render-build] FATAL: DATABASE_URL has unknown format"
    exit 1
    ;;
esac

echo "[render-build] Provider: $PROVIDER"

# ── Copy the matching schema ──
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-build] Copying PostgreSQL schema..."
  cp prisma/schema.postgres.prisma prisma/schema.prisma
else
  echo "[render-build] Copying SQLite schema..."
  cp prisma/schema.sqlite.prisma prisma/schema.prisma
  mkdir -p data
fi

# ── Generate Prisma client BEFORE the Next.js build ─────────────
# This is critical: `next build` (especially with Turbopack) bundles the
# @prisma/client module at build time. If the client in node_modules
# was generated with the wrong provider, the bundle will be wrong and
# `next start` will load the wrong client at runtime — no matter what
# we do in render-start.sh afterwards.
#
# So we MUST ensure the Prisma Client is generated with the correct
# provider BEFORE `next build` runs.
echo "[render-build] Clearing cached Prisma client..."
rm -rf node_modules/.prisma node_modules/@prisma/client

echo "[render-build] Running prisma generate (provider=$PROVIDER)..."
npx prisma generate

# Verify the schema AND the generated client match the expected provider
echo "[render-build] Verifying Prisma provider (schema + generated client)..."
node scripts/check-prisma-provider.cjs

# ── Build Next.js ─────────────────────────────────────────────
# NOTE: do NOT call `npm run build` here because that script does
# `prisma generate && next build` — and the implicit `prisma generate`
# would run WITHOUT our schema.prisma override (it would use whatever
# schema is configured). We've already generated the client above with
# the correct provider, so we go straight to `next build`.
echo "[render-build] Building Next.js (no standalone output)..."
next build

# ── Verify the build succeeded ────────────────────────────────
echo "[render-build] Verifying build output..."
test -d .next || { echo "[render-build] FATAL: .next directory missing after build"; exit 1; }
test -f .next/BUILD_ID || { echo "[render-build] FATAL: .next/BUILD_ID missing after build"; exit 1; }
echo "[render-build] ✓ .next/BUILD_ID present ($(cat .next/BUILD_ID))"

# ── Final provider verification ───────────────────────────────
# After everything is built, verify one more time that the Prisma Client
# in node_modules is still the correct one (next build shouldn't have
# changed it, but let's be paranoid).
echo "[render-build] Final Prisma provider verification..."
node scripts/check-prisma-provider.cjs

echo "[render-build] ─────────────────────────────────────────────"
echo "[render-build] ✓ Build complete! Provider=$PROVIDER"
echo "[render-build] NOTE: render-start.sh will verify the provider"
echo "[render-build]       again at runtime and refuse to start if"
echo "[render-build]       the client doesn't match DATABASE_URL."
echo "[render-build] ─────────────────────────────────────────────"
