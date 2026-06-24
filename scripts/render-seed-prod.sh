#!/usr/bin/env bash
# =============================================================================
# KFM Delice — Production Re-Seed via Render Shell
# =============================================================================
# This script provides the exact commands to run inside the Render web shell
# to re-seed the production database with fresh accounts (random passwords,
# mustChangePassword=true for everyone).
#
# USAGE:
#   1. Open Render Dashboard → your kfm-delice web service → Shell tab
#   2. Paste the commands below (or upload this script and run it)
#
# IMPORTANT:
#   - This will DELETE all existing orders, reservations, reviews, etc.
#   - All accounts will get new random passwords
#   - All users must change their password on next login
#   - Run this ONCE before going live
# =============================================================================
set -euo pipefail

if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  GREEN=$(tput setaf 2); RED=$(tput setaf 1); YELLOW=$(tput setaf 3); BLUE=$(tput setaf 4); BOLD=$(tput bold); RESET=$(tput sgr0)
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi

echo "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo "${BOLD}${BLUE}║  KFM Delice — Production Re-Seed                              ║${RESET}"
echo "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "${YELLOW}⚠  WARNING: This will purge all transactional data.${RESET}"
echo "${YELLOW}   All accounts will get new random passwords.${RESET}"
echo "${YELLOW}   All users will be forced to change password on next login.${RESET}"
echo ""

# ── Verify we're on Render (or have DATABASE_URL) ──
if [ -z "${DATABASE_URL:-}" ]; then
  echo "${RED}ERROR: DATABASE_URL is not set.${RESET}"
  echo "This script should be run inside the Render Shell where env vars are auto-loaded."
  echo ""
  echo "If running locally, set DATABASE_URL first:"
  echo "  export DATABASE_URL='postgresql://...'"
  exit 1
fi

# ── Mask DATABASE_URL for display ──
masked_url=$(echo "$DATABASE_URL" | sed -E 's|://([^:]+):[^@]+@|://\1:***@|')
echo "  Database: ${BLUE}${masked_url}${RESET}"
echo "  Provider: $(case "$DATABASE_URL" in postgresql://*|postgres://*) echo "PostgreSQL ✅";; file:*) echo "SQLite";; *) echo "unknown";; esac)"
echo ""

# ── Check that we're not on SQLite (Render should be PostgreSQL) ──
case "$DATABASE_URL" in
  postgresql://*|postgres://*)
    echo "${GREEN}✓ PostgreSQL detected — production-grade storage${RESET}"
    ;;
  file:*)
    echo "${YELLOW}⚠ SQLite detected — make sure this is intentional${RESET}"
    echo "${YELLOW}  (Render free PostgreSQL expires after 90 days, so SQLite is OK for demo)${RESET}"
    ;;
esac
echo ""

# ── Verify JWT_SECRET is set (needed for password hashing verification) ──
if [ -z "${JWT_SECRET:-}" ]; then
  echo "${RED}ERROR: JWT_SECRET is not set.${RESET}"
  echo "Set it in Render dashboard → Environment tab."
  exit 1
fi
echo "${GREEN}✓ JWT_SECRET is set (length: ${#JWT_SECRET})${RESET}"
echo ""

# ── Switch to PostgreSQL schema if needed ──
if [[ "$DATABASE_URL" == postgresql://* || "$DATABASE_URL" == postgres://* ]]; then
  if [ -f "prisma/schema.postgres.prisma" ]; then
    echo "${BLUE}Switching to PostgreSQL schema...${RESET}"
    cp prisma/schema.postgres.prisma prisma/schema.prisma
  fi
fi

# ── Dry-run first ──
echo "${BOLD}${BLUE}── Step 1: Dry-run (preview changes) ──${RESET}"
if bunx tsx scripts/seed-production.ts --dry-run --yes 2>&1; then
  echo ""
  echo "${GREEN}✓ Dry-run completed successfully${RESET}"
else
  echo "${RED}✗ Dry-run failed. Aborting.${RESET}"
  exit 1
fi

echo ""
echo "${BOLD}${YELLOW}── Step 2: Confirm production re-seed ──${RESET}"
echo "Type 'purge-and-seed' to continue (or anything else to abort):"
read -r CONFIRM
if [ "$CONFIRM" != "purge-and-seed" ]; then
  echo "${YELLOW}Aborted. No changes made.${RESET}"
  exit 0
fi

# ── Real run ──
echo ""
echo "${BOLD}${BLUE}── Step 3: Running production re-seed ──${RESET}"
if bunx tsx scripts/seed-production.ts --yes 2>&1 | tee /tmp/seed-output.txt; then
  echo ""
  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║  ✓ PRODUCTION RE-SEED COMPLETE                                ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo "${YELLOW}⚠  SAVE THE CREDENTIAL REPORT BELOW IN A SECURE LOCATION${RESET}"
  echo "${YELLOW}   (1Password, Bitwarden, encrypted file, etc.)${RESET}"
  echo ""
  echo "Credentials summary:"
  grep -E "Password:|Email:|Admin:|Customer:|Driver:|Platform" /tmp/seed-output.txt | head -50
  echo ""
  echo "${BOLD}Next steps:${RESET}"
  echo "  1. Copy the credential report to a password manager"
  echo "  2. Test login with platform admin: https://your-service.onrender.com/login"
  echo "  3. Each user must change their password on first login"
  echo "  4. Run smoke test: bash scripts/smoke-test.sh https://your-service.onrender.com"
  exit 0
else
  echo "${BOLD}${RED}✗ Production re-seed FAILED${RESET}"
  echo ""
  echo "Common causes:"
  echo "  - DATABASE_URL points to a DB that doesn't exist yet (run prisma db push first)"
  echo "  - JWT_SECRET missing or too short"
  echo "  - Prisma client not generated (run: npx prisma generate)"
  echo "  - Schema mismatch (run: npx prisma db push --accept-data-loss)"
  exit 1
fi
