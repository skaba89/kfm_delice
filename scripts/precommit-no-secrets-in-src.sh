#!/usr/bin/env bash
# Pre-commit hook: scan src/ for obvious live secrets
set -e
if grep -rE "(sk_live_[A-Za-z0-9]{24,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36})" src/ 2>/dev/null; then
  echo "ERROR: Found live secrets in src/. Remove them before committing." >&2
  exit 1
fi
exit 0
