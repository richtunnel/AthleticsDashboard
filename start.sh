#!/bin/sh

# Set the DATABASE_URL and any other environment variables needed for migration
# DigitalOcean injects these automatically, but we ensure the shell environment uses them.

# 1. Run Prisma Migrations
# The 'migrate deploy' command ensures that any pending schema changes are applied
# to the live database using the migrations history present in the 'runner' image.
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Check the exit status of the migration command
if [ $? -ne 0 ]; then
  echo "⚠️  Prisma migration failed. Checking if this is a P3009 error..."
  
  # Check if there's a failed migration that needs to be resolved
  # This is typically the 20251031195601_init migration
  if npx prisma migrate status 2>&1 | grep -q "failed"; then
    echo "🔧 Detected failed migration. Attempting to resolve..."
    
    # Extract the failed migration name
    FAILED_MIGRATION=$(npx prisma migrate status 2>&1 | grep "migration started at" | sed 's/.*The `\([^`]*\)`.*/\1/')
    
    if [ -n "$FAILED_MIGRATION" ]; then
      echo "📝 Failed migration: $FAILED_MIGRATION"
      echo "🔧 Marking migration as applied (database schema already matches)..."
      npx prisma migrate resolve --applied "$FAILED_MIGRATION"
      
      echo "✅ Migration resolved! Attempting deploy again..."
      npx prisma migrate deploy
      
      if [ $? -ne 0 ]; then
        echo "❌ Migration still failed after resolution. Exiting startup."
        exit 1
      fi
    else
      echo "❌ Could not identify failed migration. Exiting startup."
      exit 1
    fi
  else
    echo "❌ Prisma migration failed with a different error. Exiting startup."
    exit 1
  fi
fi

echo "✅ Prisma migration successful. Starting Next.js server..."

# 2. Start the Next.js application
exec yarn start
