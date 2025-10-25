#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
SCHEMA_PATH="${PROJECT_ROOT}/prisma/schema.prisma"

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required to run Prisma commands." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat <<'EOF' >&2
Error: DATABASE_URL is not set.
Export your target database connection string before running the pre-deployment check, e.g.:
  export DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
EOF
  exit 1
fi

echo "🔎 Running Prisma migration status check before deployment..."
STATUS_OUTPUT=$(npx prisma migrate status --schema "${SCHEMA_PATH}" 2>&1 | tee /dev/stderr)

if echo "${STATUS_OUTPUT}" | grep -q "Following migrations have not yet been applied"; then
  echo "❌ Pending migrations detected. Run 'npx prisma migrate deploy' before starting the application." >&2
  exit 2
fi

if echo "${STATUS_OUTPUT}" | grep -q "Drift detected"; then
  echo "❌ Drift detected between the database and schema. Investigate before deploying." >&2
  exit 3
fi

if echo "${STATUS_OUTPUT}" | grep -q "We need to reset the database"; then
  echo "❌ Prisma recommends a database reset. Resolve drift or data issues before deploying." >&2
  exit 4
fi

echo "✅ Database schema is in sync with the Prisma schema."
