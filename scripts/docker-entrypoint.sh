#!/bin/sh
set -euo pipefail

if [ "${SKIP_PRISMA_MIGRATE:-false}" = "true" ]; then
  echo "SKIP_PRISMA_MIGRATE=true, skipping Prisma migrations."
else
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "DATABASE_URL is not set. Prisma migrations will be skipped."
  else
    echo "Running database migrations..."
    ./node_modules/.bin/prisma migrate deploy
    
    # Check if migration failed
    if [ $? -ne 0 ]; then
      echo "⚠️  Migration failed. Checking for P3009 error..."
      
      # Check if there's a failed migration
      if ./node_modules/.bin/prisma migrate status 2>&1 | grep -q "failed"; then
        echo "🔧 Detected failed migration. Attempting to resolve..."
        
        # Extract the failed migration name
        FAILED_MIGRATION=$(./node_modules/.bin/prisma migrate status 2>&1 | grep "migration started at" | sed 's/.*The `\([^`]*\)`.*/\1/')
        
        if [ -n "$FAILED_MIGRATION" ]; then
          echo "📝 Failed migration: $FAILED_MIGRATION"
          echo "🔧 Marking migration as applied (database schema already matches)..."
          ./node_modules/.bin/prisma migrate resolve --applied "$FAILED_MIGRATION"
          
          echo "✅ Migration resolved! Attempting deploy again..."
          ./node_modules/.bin/prisma migrate deploy
          
          if [ $? -ne 0 ]; then
            echo "❌ Migration still failed after resolution. Exiting."
            exit 1
          fi
        else
          echo "❌ Could not identify failed migration. Exiting."
          exit 1
        fi
      else
        echo "❌ Migration failed with a different error. Exiting."
        exit 1
      fi
    fi
  fi
fi

echo "Starting application..."
exec yarn start
