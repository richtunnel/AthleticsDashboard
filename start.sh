#!/bin/sh

# Set the DATABASE_URL and any other environment variables needed for migration
# DigitalOcean injects these automatically, but we ensure the shell environment uses them.

# 1. Clean up any failed migration records from the database
# This handles cases where migrations with incorrect timestamps or other issues
# are blocking new migrations from being applied
echo "Cleaning up failed migration records..."
node ./scripts/clean-failed-migrations.js

# 2. Run Prisma Migrations
# The 'migrate deploy' command ensures that any pending schema changes are applied
# to the live database using the migrations history present in the 'runner' image.
echo "Running Prisma migrations..."
npx prisma migrate deploy

# Check the exit status of the migration command
if [ $? -ne 0 ]; then
  echo "Prisma migration failed. Exiting startup."
  exit 1
fi

echo "Prisma migration successful. Starting Next.js server..."

# 2. Start the Next.js application
exec yarn start
