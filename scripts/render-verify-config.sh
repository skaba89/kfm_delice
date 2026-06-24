#!/usr/bin/env bash
# =============================================================================
# KFM Delice — Render Env Vars Verifier
# =============================================================================
# Print a ready-to-paste list of all environment variables that must be set
# in the Render dashboard for the production deployment.
#
# Usage:
#   bash scripts/render-verify-config.sh           # interactive list
#   bash scripts/render-verify-config.sh --json    # JSON output for piping
# =============================================================================
set -uo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

OUTPUT_JSON=false
[[ "${1:-}" == "--json" ]] && OUTPUT_JSON=true

# ── Required env vars (block deploy if missing) ──
REQUIRED_VARS=(
  "DATABASE_URL:PostgreSQL connection string (auto-set by Render via fromDatabase)"
  "JWT_SECRET:64+ char random hex (openssl rand -hex 32)"
  "PUBLIC_APP_URL:https://your-service-name.onrender.com"
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY:VAPID public key (web-push generate-vapid-keys)"
  "VAPID_PRIVATE_KEY:VAPID private key"
  "VAPID_SUBJECT:mailto:admin@kfm-delice.com"
)

# ── Recommended for production (warn if missing) ──
RECOMMENDED_VARS=(
  "JWT_EXPIRES_IN:604800 (7 days in seconds)"
  "TENANT_STRATEGY:slug-header"
  "NEXT_PUBLIC_SHOW_DEMO_CREDS:false (hide demo creds on login page)"
  "NEXT_TELEMETRY_DISABLED:1"
  "NODE_ENV:production"
  "PORT:10000 (Render default)"
  "HOSTNAME:0.0.0.0"
)

# ── SMTP (email) — required for order confirmations ──
SMTP_VARS=(
  "SMTP_HOST:smtp-relay.brevo.com (Brevo) or smtp.sendgrid.net (SendGrid)"
  "SMTP_PORT:587"
  "SMTP_SECURE:false (use 465 + true for SSL)"
  "SMTP_USER:your-brevo-username"
  "SMTP_PASS:your-brevo-smtp-key"
  "EMAIL_FROM:KFM Delice <noreply@yourdomain.com>"
)

# ── Mobile Money (Guinée) — required for real payments ──
MOBILE_MONEY_VARS=(
  "ORANGE_MERCHANT_KEY:(from Orange Money Developer Portal)"
  "ORANGE_CLIENT_ID:(from Orange Money Developer Portal)"
  "ORANGE_CLIENT_SECRET:(from Orange Money Developer Portal)"
  "ORANGE_RETURN_URL:https://your-service.onrender.com/api/payment/orange-return"
  "MTN_API_USER:(from MTN MoMo Developer Portal)"
  "MTN_API_KEY:(from MTN MoMo Developer Portal)"
  "MTN_SUBSCRIPTION_KEY:(from MTN Developer Portal)"
  "MTN_ENVIRONMENT:sandbox (then production when live)"
)

# ── Optional / advanced ──
OPTIONAL_VARS=(
  "AUTH_RATE_LIMIT:10 (login attempts per minute)"
  "AUTH_RATE_WINDOW_MS:60000"
  "API_RATE_LIMIT:60 (requests per minute)"
  "API_RATE_WINDOW_MS:60000"
  "UPLOAD_DIR:./uploads"
  "MAX_UPLOAD_MB:5"
)

if $OUTPUT_JSON; then
  cat <<'EOF'
{
  "required":     ["DATABASE_URL","JWT_SECRET","PUBLIC_APP_URL","NEXT_PUBLIC_VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","VAPID_SUBJECT"],
  "recommended":  ["JWT_EXPIRES_IN","TENANT_STRATEGY","NEXT_PUBLIC_SHOW_DEMO_CREDS","NEXT_TELEMETRY_DISABLED","NODE_ENV","PORT","HOSTNAME"],
  "smtp":         ["SMTP_HOST","SMTP_PORT","SMTP_SECURE","SMTP_USER","SMTP_PASS","EMAIL_FROM"],
  "mobile_money": ["ORANGE_MERCHANT_KEY","ORANGE_CLIENT_ID","ORANGE_CLIENT_SECRET","ORANGE_RETURN_URL","MTN_API_USER","MTN_API_KEY","MTN_SUBSCRIPTION_KEY","MTN_ENVIRONMENT"],
  "optional":     ["AUTH_RATE_LIMIT","AUTH_RATE_WINDOW_MS","API_RATE_LIMIT","API_RATE_WINDOW_MS","UPLOAD_DIR","MAX_UPLOAD_MB"]
}
EOF
  exit 0
fi

echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║  KFM Delice — Render Env Vars Configuration                   ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Copy these keys into Render Dashboard → Environment tab${NC}"
echo ""

print_section() {
  local title="$1"
  shift
  local -a vars=("$@")
  echo -e "${BOLD}${BLUE}── ${title} ──${NC}"
  for entry in "${vars[@]}"; do
    key="${entry%%:*}"
    desc="${entry#*:}"
    printf "  ${YELLOW}%-35s${NC}  %s\n" "$key" "$desc"
  done
  echo ""
}

print_section "REQUIRED (deploy will fail without these)"        "${REQUIRED_VARS[@]}"
print_section "RECOMMENDED (sensible defaults shown)"            "${RECOMMENDED_VARS[@]}"
print_section "SMTP — Email (REQUIRED for order confirmations)"  "${SMTP_VARS[@]}"
print_section "MOBILE MONEY — Real payments (Guinée)"            "${MOBILE_MONEY_VARS[@]}"
print_section "OPTIONAL — Rate limiting & uploads"               "${OPTIONAL_VARS[@]}"

echo -e "${BOLD}${GREEN}── Ready-to-paste values (from secrets-production.txt) ──${NC}"
SECRETS_FILE="${HOME}/.kfm-secrets-production.txt"
if [ -f "/home/z/my-project/download/secrets-production.txt" ]; then
  SECRETS_FILE="/home/z/my-project/download/secrets-production.txt"
elif [ -f "./secrets-production.txt" ]; then
  SECRETS_FILE="./secrets-production.txt"
fi

if [ -f "$SECRETS_FILE" ]; then
  echo -e "  Source: ${BLUE}${SECRETS_FILE}${NC}"
  echo ""
  grep -E '^(JWT_SECRET|WEBHOOK_SECRET|NEXT_PUBLIC_VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|VAPID_SUBJECT)=' "$SECRETS_FILE" | while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    # Mask the value (show first 8 + last 4 chars)
    if [ ${#val} -gt 16 ]; then
      masked="${val:0:8}...${val: -4}"
    else
      masked="$val"
    fi
    printf "  ${GREEN}%-35s${NC}  %s\n" "$key" "$masked"
  done
  echo ""
  echo -e "${YELLOW}  ⚠ The full values are in the file above. Copy them carefully.${NC}"
  echo -e "${YELLOW}  ⚠ Delete the file after configuring Render.${NC}"
else
  echo -e "  ${RED}Secrets file not found. Generate it with:${NC}"
  echo -e "    openssl rand -hex 32  # for JWT_SECRET"
  echo -e "    npx web-push generate-vapid-keys --json  # for VAPID keys"
fi

echo ""
echo -e "${BOLD}${BLUE}── Render free tier notes ──${NC}"
echo -e "  ${YELLOW}• Free web service sleeps after 15 min of inactivity${NC}"
echo -e "  ${YELLOW}• First request after sleep takes ~30s (cold start)${NC}"
echo -e "  ${YELLOW}• Free PostgreSQL expires after 90 days (use SQLite for dev)${NC}"
echo -e "  ${YELLOW}• Free tier: 750 hours/month, 100 GB bandwidth${NC}"
echo ""
echo -e "${BOLD}Next step:${NC} after setting env vars, trigger a Manual Deploy"
echo -e "  in Render dashboard → Deploy tab → Manual Deploy → Deploy Latest Commit"
echo ""
echo -e "${BOLD}Then run:${NC} bash scripts/render-postdeploy.sh https://your-service.onrender.com"
