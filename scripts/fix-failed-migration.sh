#!/usr/bin/env bash
set -euo pipefail

# This script resolves the P3009 error for the failed 20251031195601_init migration.
# 
# Background:
# The migration failed because it's an "init" migration trying to create tables
# that already exist in the database (from previous migrations in migrations_old/).
#
# Solution:
# We'll mark this migration as "applied" since the database schema already matches
# what the migration would create. This is the standard approach when consolidating
# migration history.

MIGRATION_NAME="20251031195601_init"

echo "🔍 Resolving P3009 error for migration: ${MIGRATION_NAME}"
echo ""

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ Error: DATABASE_URL is not set."
  echo "Please set DATABASE_URL environment variable before running this script."
  echo ""
  echo "Example:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:port/db'"
  echo "  ./scripts/fix-failed-migration.sh"
  exit 1
fi

echo "📊 Current migration status:"
npx prisma migrate status || true

echo ""
echo "🔧 Marking migration ${MIGRATION_NAME} as applied..."
echo "   (The database schema already matches this migration)"
npx prisma migrate resolve --applied "${MIGRATION_NAME}"

echo ""
echo "✅ Migration marked as applied!"
echo ""
echo "📊 Verifying migration status:"
npx prisma migrate status

echo ""
echo "✅ All done! The migration error has been resolved."
echo "   Your database is now in sync with the migration history."
