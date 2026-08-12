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

# ── Install ALL dependencies (including dev) ──────────────────
# Render may skip devDependencies when NODE_ENV=production.
# We MUST install them because @tailwindcss/postcss and tailwindcss
# are needed at build time for PostCSS/Tailwind CSS processing.
echo "[render-build] Installing dependencies (including dev)..."
npm ci --include=dev --no-audit --no-fund

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

# ── Verify Prisma version (CRITICAL) ───────────────────────────
# Prisma 7+ has breaking changes (datasource url no longer supported
# in schema files). We MUST use Prisma 6.x as pinned in package.json.
# If `npx prisma generate` is used instead of `node_modules/.bin/prisma`,
# it may download Prisma 7+ and break the build.
if [ -f node_modules/.bin/prisma ]; then
  PRISMA_VERSION=$(node_modules/.bin/prisma --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "[render-build] Prisma CLI version: $PRISMA_VERSION"
  case "$PRISMA_VERSION" in
    6.*)
      echo "[render-build] ✓ Prisma 6.x detected (compatible)"
      ;;
    7.*)
      echo "[render-build] FATAL: Prisma 7.x detected — has breaking schema changes."
      echo "[render-build] The schema uses 'url = env(...)' which is no longer supported in Prisma 7."
      echo "[render-build] Fix: ensure package.json pins prisma@^6.x and run 'bun install' or 'npm install' again."
      exit 1
      ;;
    *)
      echo "[render-build] WARNING: Unknown Prisma version ($PRISMA_VERSION) — may not be compatible"
      ;;
  esac
else
  echo "[render-build] WARNING: node_modules/.bin/prisma not found — dependencies may not be installed yet"
fi

# ── Copy the matching provider template ──
if [ "$PROVIDER" = "postgres" ]; then
  echo "[render-build] Copying PostgreSQL schema template..."
  cp prisma/templates/schema.postgres.template prisma/schema.prisma
else
  echo "[render-build] Copying SQLite schema template..."
  cp prisma/templates/schema.sqlite.template prisma/schema.prisma
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
echo "[render-build] Clearing generated Prisma client cache..."
# Keep the installed @prisma/client package. Deleting it makes `prisma generate`
# run an implicit npm install, which can prune devDependencies under
# NODE_ENV=production and introduces a network dependency during generation.
test -d node_modules/@prisma/client || {
  echo "[render-build] FATAL: @prisma/client is missing after npm ci"
  exit 1
}
rm -rf node_modules/.prisma

echo "[render-build] Running prisma generate (provider=$PROVIDER)..."
# Use node_modules/.bin/prisma (NOT npx prisma) — npx may download Prisma 7+
# which has breaking changes (datasource url no longer supported in schema).
# We must use the version pinned in package.json (6.x).
if [ -x node_modules/.bin/prisma ]; then
  node_modules/.bin/prisma generate
else
  echo "[render-build] WARNING: node_modules/.bin/prisma not found, falling back to npx"
  npx --no-install prisma generate || npx prisma@6 generate
fi

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
test -x node_modules/.bin/next || {
  echo "[render-build] FATAL: local Next.js binary is missing"
  exit 1
}
node_modules/.bin/next build

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
