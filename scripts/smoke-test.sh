#!/usr/bin/env bash
# KFM Delice - Post-deployment Smoke Test (19 checks, 6 categories)
set -uo pipefail
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  GREEN=$(tput setaf 2); RED=$(tput setaf 1); YELLOW=$(tput setaf 3); BLUE=$(tput setaf 4); BOLD=$(tput bold); RESET=$(tput sgr0)
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi
PASS_LABEL="${GREEN}PASS${RESET}"; FAIL_LABEL="${RED}FAIL${RESET}"; INFO_LABEL="${BLUE}INFO${RESET}"
BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"; BASE_URL="${BASE_URL%/}"
echo "${BOLD}${BLUE}+ KFM Delice - Post-deployment Smoke Test +${RESET}"
echo "  Target: $BASE_URL   Time: $(date -Iseconds)"
echo
TOTAL=0; PASSED=0; FAILED=0
check() { TOTAL=$((TOTAL + 1)); printf "  [%02d] %-55s " "$TOTAL" "$1"; }
pass() { echo "$PASS_LABEL ${1:-}"; PASSED=$((PASSED + 1)); }
fail() { echo "$FAIL_LABEL - $1"; FAILED=$((FAILED + 1)); }
info() { echo "$INFO_LABEL - $1"; }
echo "${BOLD}== Availability ==${RESET}"
check "Homepage returns 200"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "Response time < 2000ms"; ms=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$BASE_URL/" | awk '{printf "%.0f", $1 * 1000}'); [ "$ms" -lt 2000 ] && pass "(${ms}ms)" || fail "${ms}ms"
check "HTTPS reachable"; case "$BASE_URL" in
  http://localhost*|http://127.0.0.1*|https://*) info "skipped" ;;
  http://*) https_url="${BASE_URL/http:\/\//https:\/\/}"; https_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -L "$https_url/" 2>/dev/null || echo "000"); [ "$https_status" = "200" ] && pass || fail "HTTPS not reachable" ;;
esac
echo; echo "${BOLD}== Public API endpoints ==${RESET}"
check "GET /api/health"; resp=$(curl -s --max-time 10 "$BASE_URL/api/health"); status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/health")
if [ "$status" = "200" ]; then
  hs=$(echo "$resp" | grep -oE '"status"[[:space:]]*:[[:space:]]*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/' | head -1); pass "(${hs:-unknown})"
elif [ "$status" = "401" ]; then info "auth required (admin-only in prod)"; else fail "HTTP $status"; fi
check "GET /api/menu"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/menu"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "GET /api/reviews"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/reviews"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "GET /api/loyalty/rewards"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/loyalty/rewards"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "GET /api/restaurants"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/restaurants"); [ "$status" = "200" ] && pass || fail "HTTP $status"
echo; echo "${BOLD}== Auth flow ==${RESET}"
check "POST /api/auth/login (admin)"
login_resp=$(curl -s --max-time 10 -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@monrestaurant.com","password":"Admin2024!"}')
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@monrestaurant.com","password":"Admin2024!"}')
if [ "$status" = "200" ] || [ "$status" = "201" ]; then
  token=$(echo "$login_resp" | grep -oE '"token"[[:space:]]*:[[:space:]]*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/' | head -1)
  [ -n "$token" ] && pass "(token received)" || fail "no token"
else
  fail "HTTP $status - login failed"; token=""
fi
if [ -n "$token" ]; then
  check "GET /api/dashboard (with token)"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $token" "$BASE_URL/api/dashboard"); [ "$status" = "200" ] && pass || fail "HTTP $status"
  check "GET /api/orders (with token)"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $token" "$BASE_URL/api/orders"); [ "$status" = "200" ] && pass || fail "HTTP $status"
  check "GET /api/push (subscription list)"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $token" "$BASE_URL/api/push"); [ "$status" = "200" ] && pass || fail "HTTP $status"
fi
echo; echo "${BOLD}== Negative tests ==${RESET}"
check "GET /api/dashboard without token - expect 401"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/dashboard"); [ "$status" = "401" ] && pass || fail "HTTP $status"
check "POST /api/auth/login wrong password - expect 401"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@monrestaurant.com","password":"WRONG"}'); [ "$status" = "401" ] && pass || fail "HTTP $status"
echo; echo "${BOLD}== Static assets and PWA ==${RESET}"
check "GET /manifest.json"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/manifest.json"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "GET /sw.js"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/sw.js"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "GET /robots.txt"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/robots.txt"); [ "$status" = "200" ] && pass || fail "HTTP $status"
check "GET /logo.svg"; status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/logo.svg"); [ "$status" = "200" ] && pass || fail "HTTP $status"
echo; echo "${BOLD}== Security headers ==${RESET}"
headers=$(curl -s -I --max-time 10 "$BASE_URL/" 2>/dev/null)
check "X-Content-Type-Options: nosniff"; echo "$headers" | grep -qi "x-content-type-options: nosniff" && pass || fail "missing"
check "X-Frame-Options present"; echo "$headers" | grep -qiE "x-frame-options: (deny|sameorigin)" && pass || fail "missing"
check "Strict-Transport-Security (HTTPS only)"; case "$BASE_URL" in
  https://*) echo "$headers" | grep -qi "strict-transport-security" && pass || fail "missing" ;;
  *) info "skipped (not HTTPS)" ;;
esac
echo; echo "${BOLD}== Summary ==${RESET}"
printf "  Total: %d  Passed: %d  Failed: %d\n" "$TOTAL" "$PASSED" "$FAILED"
if [ "$FAILED" -gt 0 ]; then echo "${BOLD}${RED}SMOKE TEST FAILED${RESET}"; exit 1
else echo "${BOLD}${GREEN}SMOKE TEST PASSED${RESET}"; exit 0; fi
