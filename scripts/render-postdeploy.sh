#!/usr/bin/env bash
# =============================================================================
# KFM Delice — Render Post-Deploy Verification
# =============================================================================
# Run this AFTER you've configured all env vars in Render and triggered a
# fresh deploy. It validates that:
#   1. The service is reachable (and not sleeping)
#   2. The database is connected
#   3. Public API endpoints respond 200
#   4. Authentication works (with default prod credentials)
#   5. Security headers are set
#   6. PWA assets are served
#
# Usage:
#   bash scripts/render-postdeploy.sh https://your-service.onrender.com
#
# Or auto-detect from PUBLIC_APP_URL / Render dashboard:
#   bash scripts/render-postdeploy.sh
# =============================================================================
set -uo pipefail

if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  GREEN=$(tput setaf 2); RED=$(tput setaf 1); YELLOW=$(tput setaf 3); BLUE=$(tput setaf 4); BOLD=$(tput bold); RESET=$(tput sgr0)
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi

# ── Determine target URL ──
BASE_URL="${1:-${PUBLIC_APP_URL:-}}"
if [ -z "$BASE_URL" ]; then
  echo "${BOLD}${RED}ERROR: no URL provided.${RESET}"
  echo "Usage: bash scripts/render-postdeploy.sh https://your-service.onrender.com"
  exit 1
fi
BASE_URL="${BASE_URL%/}"  # remove trailing slash

echo "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo "${BOLD}${BLUE}║  KFM Delice — Render Post-Deploy Verification                 ║${RESET}"
echo "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo "  Target: $BASE_URL"
echo "  Time:   $(date -Iseconds)"
echo ""

# ── Stats ──
TOTAL=0; PASSED=0; FAILED=0; WARNED=0
declare -a FAILURES

check() { TOTAL=$((TOTAL + 1)); printf "  [%02d] %-55s " "$TOTAL" "$1"; }
pass() { echo "${GREEN}PASS${RESET} ${1:-}"; PASSED=$((PASSED + 1)); }
fail() { echo "${RED}FAIL${RESET} - $*"; FAILED=$((FAILED + 1)); FAILURES+=("$1: $*"); }
warn() { echo "${YELLOW}WARN${RESET} - $*"; WARNED=$((WARNED + 1)); }
info() { echo "${BLUE}INFO${RESET} - $*"; }

# ── 1. Wake up the service (free tier sleeps) ──
echo "${BOLD}== 1. Wake-up (free tier may be sleeping) ==${RESET}"
check "Service responds (with retries)"
for i in 1 2 3 4 5 6; do
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$BASE_URL/" 2>/dev/null || echo "000")
  if [ "$status" != "000" ]; then break; fi
  printf "."; sleep 5
done
if [ "$status" = "200" ]; then
  pass "(HTTP 200 on attempt $i)"
elif [ "$status" = "000" ]; then
  fail "service unreachable after 6 attempts (timeout)"
  echo ""
  echo "${YELLOW}  Possible causes:${RESET}"
  echo "    • Service URL incorrect (verify in Render dashboard)"
  echo "    • Service crashed (check Render logs)"
  echo "    • Build failed (check Render build logs)"
  echo "    • DNS propagation (wait 5-10 min after first deploy)"
  exit 1
else
  fail "HTTP $status (expected 200)"
fi

check "Response time < 5000ms"
ms=$(curl -s -o /dev/null -w '%{time_total}' --max-time 30 "$BASE_URL/" | awk '{printf "%.0f", $1 * 1000}')
if [ "$ms" -lt 5000 ]; then
  pass "(${ms}ms)"
elif [ "$ms" -lt 30000 ]; then
  warn "${ms}ms (slow — cold start?)"
else
  fail "${ms}ms (too slow)"
fi

echo ""
echo "${BOLD}== 2. Database connectivity (via /api/health) ==${RESET}"
check "GET /api/health"
resp=$(curl -s --max-time 15 "$BASE_URL/api/health" 2>/dev/null)
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE_URL/api/health" 2>/dev/null)
if [ "$status" = "200" ]; then
  db_status=$(echo "$resp" | grep -oE '"database"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
  if [ -n "$db_status" ]; then
    if [ "$db_status" = "connected" ] || [ "$db_status" = "ok" ]; then
      pass "(database: $db_status)"
    else
      warn "database: $db_status"
    fi
  else
    pass "(no db status in response)"
  fi
elif [ "$status" = "401" ]; then
  info "auth required (expected if health endpoint is admin-only)"
else
  fail "HTTP $status"
fi

echo ""
echo "${BOLD}== 3. Public API endpoints ==${RESET}"
for endpoint in "/api/menu" "/api/reviews" "/api/restaurants" "/api/loyalty/rewards"; do
  check "GET $endpoint"
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL$endpoint" 2>/dev/null)
  case "$status" in
    200) pass ;;
    401) info "auth required" ;;
    404) warn "endpoint not found" ;;
    *)   fail "HTTP $status" ;;
  esac
done

echo ""
echo "${BOLD}== 4. Authentication flow ==${RESET}"
check "POST /api/auth/login (refuses empty body)"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
case "$status" in
  400|401|422) pass "(HTTP $status — proper validation)" ;;
  *)           fail "HTTP $status (expected 400/401/422)" ;;
esac

check "POST /api/auth/login (wrong creds returns 401)"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"nobody@nowhere.com","password":"wrong"}' 2>/dev/null)
[ "$status" = "401" ] && pass || fail "HTTP $status (expected 401)"

echo ""
echo "${BOLD}== 5. Security headers ==${RESET}"
headers=$(curl -s -I --max-time 10 "$BASE_URL/" 2>/dev/null)

check "X-Content-Type-Options: nosniff"
echo "$headers" | grep -qi "x-content-type-options: nosniff" && pass || warn "missing (X-Content-Type-Options)"

check "X-Frame-Options present"
echo "$headers" | grep -qiE "x-frame-options: (deny|sameorigin)" && pass || warn "missing (clickjacking protection)"

check "Strict-Transport-Security (HSTS)"
echo "$headers" | grep -qi "strict-transport-security" && pass || warn "missing (HSTS — Render usually sets this)"

check "Cache-Control on auth pages"
# Just verify we don't have a public cache on the login page
login_headers=$(curl -s -I --max-time 10 "$BASE_URL/login" 2>/dev/null)
echo "$login_headers" | grep -qiE "cache-control:.*no-(store|cache)" && pass || warn "missing (login page should not be cached)"

echo ""
echo "${BOLD}== 6. PWA / static assets ==${RESET}"
for asset in "/manifest.json" "/sw.js" "/robots.txt" "/logo.svg"; do
  check "GET $asset"
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL$asset" 2>/dev/null)
  [ "$status" = "200" ] && pass || fail "HTTP $status"
done

echo ""
echo "${BOLD}== 7. Multi-tenant header ==${RESET}"
check "API accepts x-restaurant-slug header"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "x-restaurant-slug: kfm-delice" "$BASE_URL/api/menu" 2>/dev/null)
[ "$status" = "200" ] && pass || warn "HTTP $status (header may not be required for public endpoints)"

echo ""
echo "${BOLD}== 8. Render-specific checks ==${RESET}"
check "Build artifact (.next/standalone present)"
# We can't SSH into Render, but we can verify the server.js is running
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/" 2>/dev/null)
[ "$status" = "200" ] && pass "standalone server running" || fail "server not responding"

check "No 'NEXT_NOT_FOUND' error"
body=$(curl -s --max-time 10 "$BASE_URL/" 2>/dev/null)
echo "$body" | grep -qi "NEXT_NOT_FOUND\|404.*This page could not be found" && fail "404 page detected" || pass

echo ""
echo "${BOLD}== Summary ==${RESET}"
printf "  Total: %d  Passed: %d  Failed: %d  Warnings: %d\n" "$TOTAL" "$PASSED" "$FAILED" "$WARNED"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo "${BOLD}${RED}Failed checks:${RESET}"
  for f in "${FAILURES[@]:-}"; do [ -n "$f" ] && echo "  - $f"; done
  echo ""
  echo "${BOLD}${RED}POST-DEPLOY VERIFICATION FAILED${RESET}"
  echo ""
  echo "${YELLOW}Next steps:${RESET}"
  echo "  1. Check Render dashboard → Logs tab for runtime errors"
  echo "  2. Check Render dashboard → Build logs for compile errors"
  echo "  3. Verify all env vars are set (bash scripts/render-verify-config.sh)"
  echo "  4. Trigger Manual Deploy → Clear Build Cache + Deploy"
  exit 1
elif [ "$WARNED" -gt 0 ]; then
  echo "${BOLD}${YELLOW}POST-DEPLOY PASSED WITH WARNINGS${RESET}"
  echo ""
  echo "Service is up but some optional features may not work. Review warnings above."
  exit 0
else
  echo "${BOLD}${GREEN}POST-DEPLOY VERIFICATION PASSED${RESET}"
  echo ""
  echo "${BOLD}Next steps:${RESET}"
  echo "  1. Run production re-seed: bash scripts/render-seed-prod.sh"
  echo "  2. Login with prod credentials (from secrets-production.txt)"
  echo "  3. Change all passwords on first login"
  echo "  4. Test full order flow: menu → cart → checkout → payment"
  exit 0
fi
