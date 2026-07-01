#!/usr/bin/env bash
# Pre-commit hook: prevent .env files from being committed
set -e
if git diff --cached --name-only | grep -E '^\.env($|\.)' | grep -vE '\.example$'; then
  echo "ERROR: .env files are forbidden in git. Use .env.example instead." >&2
  exit 1
fi
exit 0
