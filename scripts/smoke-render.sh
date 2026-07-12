#!/bin/bash
set -euo pipefail

BASE_URL="${BASE_URL:?BASE_URL required}"

echo "[smoke] Testing $BASE_URL ..."

curl -fsS "$BASE_URL/api/status" | grep -q '"status":"ok"' || { echo "[smoke] FAIL: /api/status"; exit 1; }
echo "[smoke] ✓ /api/status"

curl -fsS "$BASE_URL/menu" > /dev/null || { echo "[smoke] FAIL: /menu"; exit 1; }
echo "[smoke] ✓ /menu"

curl -fsS "$BASE_URL/api/menu?limit=1000" > /dev/null || { echo "[smoke] FAIL: /api/menu"; exit 1; }
echo "[smoke] ✓ /api/menu?limit=1000"

echo "[smoke] ✓ All smoke tests passed"
