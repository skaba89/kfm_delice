#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# switch-schema.sh — switch Prisma provider between SQLite and PostgreSQL
# ───────────────────────────────────────────────────────────────────
# Usage:
#   bash scripts/switch-schema.sh sqlite      # local dev (default)
#   bash scripts/switch-schema.sh postgres    # production
#   bash scripts/switch-schema.sh status      # show current provider
#
# Behavior:
#   • Copies the matching provider template over prisma/schema.prisma
#   • Keeps domain models (for example platform billing) in prisma/models/*.prisma
#   • Re-runs `prisma generate` so the client picks up the active provider
#   • Does NOT touch the database itself
# ───────────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")/.."

PRISMA_DIR="prisma"
TEMPLATE_DIR="$PRISMA_DIR/templates"
TARGET="${1:-}"

if [ -z "$TARGET" ] || [ "$TARGET" = "status" ]; then
  PROVIDER=$(awk '/^datasource /{flag=1; next} flag && /provider/{gsub(/.*provider[\t ]*=[\t ]*"/,""); gsub(/".*/,""); print; exit}' "$PRISMA_DIR/schema.prisma")
  echo "Current Prisma provider: $PROVIDER"
  echo "Available provider templates:"
  ls -1 "$TEMPLATE_DIR"/schema.*.template 2>/dev/null | sed 's/^/  - /'
  echo "Domain schema files:"
  find "$PRISMA_DIR/models" -maxdepth 1 -type f -name '*.prisma' -print 2>/dev/null | sort | sed 's/^/  - /'
  exit 0
fi

if [ "$TARGET" != "sqlite" ] && [ "$TARGET" != "postgres" ]; then
  echo "Error: unknown target '$TARGET'. Use 'sqlite', 'postgres', or 'status'."
  exit 1
fi

SOURCE="$TEMPLATE_DIR/schema.$TARGET.template"

if [ ! -f "$SOURCE" ]; then
  echo "Error: $SOURCE not found."
  exit 1
fi

echo "[switch-schema] Switching to $TARGET..."
cp "$SOURCE" "$PRISMA_DIR/schema.prisma"

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    postgresql://*|postgres://*)
      if [ "$TARGET" = "sqlite" ]; then
        echo "[switch-schema] WARNING: DATABASE_URL looks like PostgreSQL but you selected sqlite."
      fi
      ;;
    file:*)
      if [ "$TARGET" = "postgres" ]; then
        echo "[switch-schema] WARNING: DATABASE_URL is a file: SQLite path but you selected postgres."
        echo "                Set DATABASE_URL to a postgresql:// URL before running migrations."
      fi
      ;;
  esac
fi

echo "[switch-schema] Regenerating Prisma client..."
npx prisma generate

echo "[switch-schema] Done. Active provider: $TARGET"
echo ""
echo "Next steps:"
if [ "$TARGET" = "postgres" ]; then
  echo "  1. Set DATABASE_URL=postgresql://user:pass@host:5432/dbname"
  echo "  2. npx prisma migrate dev --name init   (first time only)"
  echo "  3. npx prisma migrate deploy             (subsequent deploys)"
  echo "  4. npm run build && npm start"
else
  echo "  1. Set DATABASE_URL=file:./data/kfm-delice.db"
  echo "  2. npx prisma db push"
  echo "  3. npm run dev"
fi
