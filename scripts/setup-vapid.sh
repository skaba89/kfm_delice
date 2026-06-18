#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# scripts/setup-vapid.sh — Generate VAPID keys for Web Push notifications
# ───────────────────────────────────────────────────────────────────
# Outputs the env vars to add to your .env file (and Render dashboard):
#
#   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
#   VAPID_PRIVATE_KEY=...
#   VAPID_SUBJECT=mailto:admin@kfm-delice.com
#
# Usage:
#   bash scripts/setup-vapid.sh                       # print keys
#   bash scripts/setup-vapid.sh --update-env          # also update .env
# ───────────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")/.."

UPDATE_ENV="${1:-}"

echo "[vapid] Generating VAPID keypair with web-push..."
KEYS_JSON=$(npx web-push generate-vapid-keys --json 2>/dev/null)

if [ -z "$KEYS_JSON" ]; then
  echo "[vapid] ERROR: web-push generate-vapid-keys failed."
  echo "         Make sure web-push is installed: npm install web-push"
  exit 1
fi

PUBLIC_KEY=$(echo "$KEYS_JSON" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.publicKey)")
PRIVATE_KEY=$(echo "$KEYS_JSON" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log(j.privateKey)")

if [ -z "$PUBLIC_KEY" ] || [ -z "$PRIVATE_KEY" ]; then
  echo "[vapid] ERROR: failed to parse keys from web-push output:"
  echo "$KEYS_JSON"
  exit 1
fi

echo ""
echo "─── Add these to your .env file (and Render dashboard) ───"
echo ""
echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUBLIC_KEY"
echo "VAPID_PRIVATE_KEY=$PRIVATE_KEY"
echo "VAPID_SUBJECT=mailto:admin@kfm-delice.com"
echo ""

if [ "$UPDATE_ENV" = "--update-env" ] && [ -f .env ]; then
  echo "[vapid] Updating .env..."
  # Remove existing keys if present
  if grep -q "^NEXT_PUBLIC_VAPID_PUBLIC_KEY=" .env; then
    sed -i '/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/d' .env
  fi
  if grep -q "^VAPID_PRIVATE_KEY=" .env; then
    sed -i '/^VAPID_PRIVATE_KEY=/d' .env
  fi
  if grep -q "^VAPID_SUBJECT=" .env; then
    sed -i '/^VAPID_SUBJECT=/d' .env
  fi
  cat >> .env <<EOF
NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUBLIC_KEY
VAPID_PRIVATE_KEY=$PRIVATE_KEY
VAPID_SUBJECT=mailto:admin@kfm-delice.com
EOF
  echo "[vapid] ✅ .env updated."
else
  echo "[vapid] To auto-update .env, re-run with: bash scripts/setup-vapid.sh --update-env"
fi
