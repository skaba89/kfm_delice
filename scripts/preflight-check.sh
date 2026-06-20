#!/usr/bin/env bash
# KFM Delice - Pre-deployment Health Check (44 checks, 10 categories)
set -uo pipefail
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  GREEN=$(tput setaf 2); RED=$(tput setaf 1); YELLOW=$(tput setaf 3); BLUE=$(tput setaf 4); BOLD=$(tput bold); RESET=$(tput sgr0)
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi
PASS="${GREEN}PASS${RESET}"; FAIL="${RED}FAIL${RESET}"; WARN="${YELLOW}WARN${RESET}"; INFO="${BLUE}INFO${RESET}"
SKIP_TESTS=0; SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
  esac
done
TOTAL=0; PASSED=0; FAILED=0; WARNED=0
declare -a FAILURES; CURRENT_CHECK=""
check() { CURRENT_CHECK="$1"; TOTAL=$((TOTAL + 1)); printf "  [%02d] %-55s " "$TOTAL" "$CURRENT_CHECK"; }
pass() { echo "$PASS"; PASSED=$((PASSED + 1)); }
fail() { echo "$FAIL - $*"; FAILED=$((FAILED + 1)); FAILURES+=("$CURRENT_CHECK: $*"); }
warn() { echo "$WARN - $*"; WARNED=$((WARNED + 1)); }
info() { echo "$INFO - $*"; }
section() { printf "\n${BOLD}== %s ==${RESET}\n" "$1"; }
echo "${BOLD}${BLUE}+ KFM Delice - Pre-deployment Health Check +${RESET}"
echo "  Started: $(date -Iseconds)"
echo "  Branch : $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)"
echo "  Commit : $(git rev-parse --short HEAD 2>/dev/null || echo n/a)"
[ -f .env ] && { set -a; . ./.env; set +a; }
section "1. Environment variables"
for var in DATABASE_URL JWT_SECRET; do
  check "$var (required)"; val="${!var:-}"; [ -z "$val" ] && fail "missing" || pass
done
for var in NEXT_PUBLIC_APP_NAME NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM; do
  check "$var (production)"; val="${!var:-}"; [ -z "$val" ] && warn "missing - feature disabled" || pass
done
for var in PUBLIC_APP_URL ORANGE_MONEY_API_KEY MTN_MOMO_SUBSCRIPTION_KEY NEXT_PUBLIC_TENANT_STRATEGY; do
  check "$var (optional)"; val="${!var:-}"; [ -z "$val" ] && info "not set" || pass
done
check "JWT_SECRET length >= 32"; [ "${#JWT_SECRET}" -ge 32 ] && pass || fail "too short"
check "DATABASE_URL provider"; case "$DATABASE_URL" in
  postgres://*|postgresql://*) info "PostgreSQL" ;;
  file:*) info "SQLite (dev only)" ;;
  *) fail "unknown scheme" ;;
esac
section "2. Required binaries"
for bin in node npx bun git; do
  check "$bin in PATH"; command -v "$bin" >/dev/null 2>&1 && pass || fail "not installed"
done
section "3. Production build"
if [ "$SKIP_BUILD" = "1" ]; then echo "  skipped"; else
  check "next build compiles"
  if npx next build >/tmp/kfm-build.log 2>&1; then pass; else fail "see /tmp/kfm-build.log"; tail -20 /tmp/kfm-build.log | sed 's/^/      /'; fi
fi
section "4. Unit tests"
if [ "$SKIP_TESTS" = "1" ]; then echo "  skipped"; else
  check "vitest run"
  if npx vitest run >/tmp/kfm-unit.log 2>&1; then pass; else fail "see /tmp/kfm-unit.log"; fi
fi
section "5. Live E2E tests"
if [ "$SKIP_TESTS" = "1" ]; then echo "  skipped"; else
  check "e2e-live suite"
  if [ -f scripts/run-e2e.sh ] && bash scripts/run-e2e.sh >/tmp/kfm-e2e.log 2>&1; then pass; else warn "E2E failed"; fi
fi
section "6. Prisma schema sync"
check "schema.prisma exists"; [ -f prisma/schema.prisma ] && pass || fail "missing"
check "prisma generate"; npx prisma generate >/tmp/kfm-p.log 2>&1 && pass || fail "failed"
check "prisma validate"; npx prisma validate >/tmp/kfm-p.log 2>&1 && pass || fail "invalid"
section "7. Database connectivity"
check "prisma migrate status"; npx prisma migrate status >/tmp/kfm-m.log 2>&1 && pass || warn "migrate status failed"
section "8. Production artefacts"
for f in render.yaml render-build.sh render-start.sh .env.production.example \
         scripts/switch-schema.sh scripts/backup-postgres.sh scripts/restore-postgres.sh \
         scripts/migrate-sqlite-to-postgres.ts scripts/setup-vapid.sh \
         prisma/schema.postgres.prisma prisma/schema.sqlite.prisma; do
  check "$f"; [ -f "$f" ] && pass || fail "missing"
done
check "render-build.sh executable"; [ -x render-build.sh ] && pass || warn "not executable"
check "render-start.sh executable"; [ -x render-start.sh ] && pass || warn "not executable"
section "9. Git state"
check "working tree clean"; if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then pass; else warn "uncommitted changes"; fi
check "no merge conflict markers"; if ! git grep -l '^<<<<<<< ' -- . ':!node_modules' 2>/dev/null | head -1 | grep -q .; then pass; else fail "conflict markers"; fi
section "10. Security sweep"
check "no hardcoded secrets in src/"; if grep -rE "(sk_live_|sk_test_|AKIA[0-9A-Z]{16})" src/ 2>/dev/null | head -1 | grep -q .; then fail "secrets found"; else pass; fi
check ".env not tracked"; git check-ignore .env >/dev/null 2>&1 && pass || fail ".env tracked"
check "node_modules not tracked"; git check-ignore node_modules >/dev/null 2>&1 && pass || fail "node_modules tracked"
section "Summary"
printf "  Total: %d  Passed: %d  Failed: %d  Warnings: %d\n" "$TOTAL" "$PASSED" "$FAILED" "$WARNED"
if [ "$FAILED" -gt 0 ]; then
  echo "${BOLD}${RED}Failed:${RESET}"
  for f in "${FAILURES[@]:-}"; do [ -n "$f" ] && echo "  - $f"; done
  echo "${BOLD}${RED}PRE-FLIGHT FAILED${RESET}"; exit 1
elif [ "$WARNED" -gt 0 ]; then
  echo "${BOLD}${YELLOW}PRE-FLIGHT PASSED WITH WARNINGS${RESET}"; exit 0
else
  echo "${BOLD}${GREEN}PRE-FLIGHT PASSED${RESET}"; exit 0
fi
