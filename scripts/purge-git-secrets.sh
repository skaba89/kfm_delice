#!/usr/bin/env bash
# =============================================================================
# KFM Delice — Git History Secrets Purge Script
# =============================================================================
# Usage:
#   bash scripts/purge-git-secrets.sh            # interactive (asks y/n)
#   bash scripts/purge-git-secrets.sh --dry-run  # show what would be done
#   bash scripts/purge-git-secrets.sh --force    # no confirmation
#
# Prerequisites:
#   - Python 3.8+ installed
#   - git-filter-repo installed: pip install git-filter-repo
#   - Run from the repo root: cd kfm_delice && bash scripts/purge-git-secrets.sh
#
# This script will:
#   1. Backup the current .git directory to .git-backup-<timestamp>
#   2. Create a secrets-redaction file with all known leaked secrets
#   3. Run git-filter-repo to rewrite ALL commits, replacing secrets with REDACTED
#   4. Force-push the cleaned history to origin/main
#   5. Print the procedure for revoking/rotating the leaked secrets
#
# ⚠️  WARNING: This is a DESTRUCTIVE operation. It rewrites git history.
#   - Anyone with a clone of the repo must re-clone after the purge.
#   - Open PRs will need to be re-based on the new main.
#   - The force-push will overwrite the remote main branch.
# =============================================================================

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Args ──
DRY_RUN=false
FORCE=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  KFM Delice — Git History Secrets Purge                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Mode: $(${DRY_RUN} && echo 'DRY-RUN (no changes will be made)' || echo 'LIVE — will rewrite history')"
echo ""

# ── Step 1: Verify prerequisites ──
echo -e "${BLUE}[1/5] Checking prerequisites...${NC}"

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}  ✗ python3 not found. Install Python 3.8+ first.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ python3: $(python3 --version)${NC}"

if ! python3 -c "import git_filter_repo" 2>/dev/null && ! command -v git-filter-repo &>/dev/null; then
  echo -e "${YELLOW}  ⚠ git-filter-repo not found. Installing via pip...${NC}"
  pip3 install git-filter-repo
fi
echo -e "${GREEN}  ✓ git-filter-repo available${NC}"

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo -e "${RED}  ✗ Not inside a git repository. Run from repo root.${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓ git repository detected${NC}"

# Verify we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${YELLOW}  ⚠ Currently on '$CURRENT_BRANCH', not 'main'.${NC}"
  if ! $FORCE; then
    read -p "  Continue anyway? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
  fi
fi

# Verify clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
  echo -e "${RED}  ✗ Working tree not clean. Commit or stash changes first.${NC}"
  git status --short
  exit 1
fi
echo -e "${GREEN}  ✓ Working tree clean${NC}"

# ── Step 2: Backup .git ──
echo ""
echo -e "${BLUE}[2/5] Backing up .git directory...${NC}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=".git-backup-${TIMESTAMP}"
if $DRY_RUN; then
  echo -e "${YELLOW}  [dry-run] would cp -r .git ${BACKUP_DIR}${NC}"
else
  cp -r .git "$BACKUP_DIR"
  echo -e "${GREEN}  ✓ Backup: ${BACKUP_DIR} ($(du -sh "$BACKUP_DIR" | cut -f1))${NC}"
fi

# ── Step 3: Create redaction file ──
echo ""
echo -e "${BLUE}[3/5] Creating secrets redaction file...${NC}"

REDACT_FILE=$(mktemp /tmp/kfm-redact.XXXXXX.txt)
trap 'rm -f "$REDACT_FILE"' EXIT

# All known leaked secrets from the audit
cat > "$REDACT_FILE" << 'EOF'
REPLACEMENT==>REPLACEMENT
***REMOVED***

***REMOVED***
JWT_SECRET_REDACTED==>JWT_SECRET_REDACTED

***REMOVED***
JWT_SECRET_REDACTED==>JWT_SECRET_REDACTED

***REMOVED***
WEBHOOK_SECRET_REDACTED==>WEBHOOK_SECRET_REDACTED
EOF

SECRETS_COUNT=$(grep -c "==" "$REDACT_FILE")
echo -e "${GREEN}  ✓ ${SECRETS_COUNT} secrets registered for redaction${NC}"
echo ""
echo "  Secrets to purge:"
sed -n 's/^\([^=]*\)==>.*/    - \1/p' "$REDACT_FILE"

# ── Step 4: Run git-filter-repo ──
echo ""
echo -e "${BLUE}[4/5] Rewriting git history with git-filter-repo...${NC}"

if $DRY_RUN; then
  echo -e "${YELLOW}  [dry-run] would run:${NC}"
  echo "    git filter-repo --replace-text $REDACT_FILE --force"
  echo ""
  echo -e "${YELLOW}  [dry-run] would then force-push:${NC}"
  echo "    git push origin --force --all"
  echo "    git push origin --force --tags"
  echo ""
  echo -e "${GREEN}  ✓ Dry-run complete. No changes made.${NC}"
  exit 0
fi

# Confirm before destructive operation
if ! $FORCE; then
  echo ""
  echo -e "${RED}  ⚠⚠⚠  DESTRUCTIVE OPERATION  ⚠⚠⚠${NC}"
  echo "  This will:"
  echo "    1. Rewrite ALL 82+ commits in your git history"
  echo "    2. Replace leaked secrets with REDACTED placeholders"
  echo "    3. Force-push to origin/main (overwriting remote)"
  echo "    4. Invalidate all existing clones (everyone must re-clone)"
  echo ""
  read -p "  Type 'purge' to confirm: " -r
  echo
  [[ ! "$REPLY" == "purge" ]] && { echo "Aborted."; exit 1; }
fi

# Run the purge
git filter-repo --replace-text "$REDACT_FILE" --force

echo -e "${GREEN}  ✓ History rewritten locally${NC}"

# Verify no more secrets remain
echo ""
echo -e "${BLUE}      Verifying no secrets remain...${NC}"
REMAINING=$(git log --all -p 2>/dev/null | grep -acE "1196f848153e3c0a64241de6beefb90e|kfm-delice-jwt-secret-2024-secure|kfm-delice-webhook-secret-2024-hmac" || echo "0")
if [[ "$REMAINING" -gt 0 ]]; then
  echo -e "${RED}  ✗ ${REMAINING} secrets still found in history! Purge failed.${NC}"
  echo "  Restore from backup: rm -rf .git && mv $BACKUP_DIR .git"
  exit 1
fi
echo -e "${GREEN}  ✓ All secrets purged from history${NC}"

# ── Step 5: Force-push ──
echo ""
echo -e "${BLUE}[5/5] Force-pushing cleaned history to origin...${NC}"

# Re-add origin if filter-repo removed it (filter-repo removes remotes by default)
if ! git remote get-url origin &>/dev/null; then
  echo -e "${YELLOW}  origin remote was removed by filter-repo, re-adding...${NC}"
  git remote add origin https://github.com/skaba89/kfm_delice.git
fi

if ! $FORCE; then
  read -p "  Force-push to origin/main now? (y/N) " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && { echo "  Skipped. Run manually: git push origin --force --all"; exit 0; }
fi

git push origin --force --all
git push origin --force --tags 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ PURGE COMPLETE                                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Backup of original .git: $BACKUP_DIR"
echo "  (delete after 7 days if everything works: rm -rf $BACKUP_DIR)"
echo ""
echo -e "${YELLOW}  ⚠ MANDATORY POST-PURGE ACTIONS:${NC}"
echo ""
echo "  1. ROTATE the leaked secrets (they must be considered compromised):"
echo "     - Generate new JWT_SECRET:   openssl rand -hex 32"
echo "     - Generate new WEBHOOK_SECRET: openssl rand -hex 32"
echo "     - Update Render env vars with the new values"
echo "     - Restart the web service"
echo ""
echo "  2. INFORM all collaborators:"
echo "     - They must re-clone the repo (the old clone has the old history)"
echo "     - Commands for them:"
echo "         cd .. && rm -rf kfm_delice"
echo "         git clone https://github.com/skaba89/kfm_delice.git"
echo "         cd kfm_delice && npm install"
echo ""
echo "  3. VERIFY on GitHub:"
echo "     - Open https://github.com/skaba89/kfm_delice/commits/main"
echo "     - Check that the .env file no longer appears in any commit"
echo "     - Run: git log --all -p | grep '1196f848'  (should return nothing)"
echo ""
echo "  4. MONITOR for unusual activity on:"
echo "     - The Render deployment (CPU spikes, unknown deploys)"
echo "     - The database (unusual queries, data exfiltration)"
echo "     - Admin accounts (login attempts from unknown IPs)"
echo ""
echo -e "${GREEN}  Done. See guide-securisation-depot.pdf for full procedure.${NC}"
