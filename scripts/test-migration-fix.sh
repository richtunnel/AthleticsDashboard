#!/usr/bin/env bash
set -euo pipefail

# Test script to verify the migration fix works correctly
# This is for local testing only - do not run in production

echo "🧪 Testing Migration Fix Script"
echo "================================"
echo ""

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set."
  echo "This test requires a valid DATABASE_URL."
  echo ""
  echo "Example:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:port/testdb'"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

echo "📊 Step 1: Check current migration status"
echo "==========================================="
npx prisma migrate status || {
  echo ""
  echo "⚠️  Migration status check failed (expected if P3009 error exists)"
}

echo ""
echo "🔧 Step 2: Run the fix script"
echo "=============================="
if [ -f "./scripts/fix-failed-migration.sh" ]; then
  bash ./scripts/fix-failed-migration.sh
else
  echo "❌ Fix script not found at ./scripts/fix-failed-migration.sh"
  exit 1
fi

echo ""
echo "📊 Step 3: Verify migration status after fix"
echo "============================================="
npx prisma migrate status

echo ""
echo "✅ Test complete!"
echo ""
echo "Expected result:"
echo "  - All migrations should be marked as applied"
echo "  - No pending migrations"
echo "  - No failed migrations"
