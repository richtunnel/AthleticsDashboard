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
  fi
fi

echo "Starting application..."
exec yarn start
