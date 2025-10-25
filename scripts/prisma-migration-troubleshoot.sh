#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
SCHEMA_PATH="${PROJECT_ROOT}/prisma/schema.prisma"

usage() {
  cat <<'EOF'
Prisma migration troubleshooting helper

Usage:
  ./scripts/prisma-migration-troubleshoot.sh <command> [options]

Commands:
  status                         Show current migration status using the active DATABASE_URL
  resolve-rolled-back <id>       Mark a failed migration as rolled back so that it can be re-applied
  resolve-applied <id>           Mark a failed migration as successfully applied (use only if schema already matches)
  deploy                         Apply all pending migrations to the target database
  reset                          Reset the database (drops data) and re-applies all migrations (development only)
  help                           Show this message

Examples:
  DATABASE_URL="postgresql://..." ./scripts/prisma-migration-troubleshoot.sh status
  ./scripts/prisma-migration-troubleshoot.sh resolve-rolled-back 20251024000526_new_migration

The script expects DATABASE_URL to be exported in the environment unless you are using prisma's --url flag manually.
EOF
}

ensure_prisma() {
  if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx is required to run Prisma CLI commands." >&2
    exit 1
  fi
}

ensure_database_url() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL is not set. Export the database connection string before running this command." >&2
    exit 1
  fi
}

run_prisma() {
  npx prisma "$@" --schema "${SCHEMA_PATH}"
}

COMMAND=${1:-help}
ARG=${2:-}

ensure_prisma

case "${COMMAND}" in
  status)
    ensure_database_url
    echo "🔍 Checking Prisma migration status..."
    run_prisma migrate status
    ;;
  resolve-rolled-back)
    ensure_database_url
    if [[ -z "${ARG}" ]]; then
      echo "Error: missing migration id." >&2
      usage
      exit 1
    fi
    echo "↩️  Marking migration ${ARG} as rolled back..."
    run_prisma migrate resolve --rolled-back "${ARG}"
    echo "✅ Migration marked as rolled back. Review the SQL file, make any required fixes, then run the deploy command."
    ;;
  resolve-applied)
    ensure_database_url
    if [[ -z "${ARG}" ]]; then
      echo "Error: missing migration id." >&2
      usage
      exit 1
    fi
    echo "✅ Marking migration ${ARG} as applied (use only if the schema already matches the database)..."
    run_prisma migrate resolve --applied "${ARG}"
    ;;
  deploy)
    ensure_database_url
    echo "🚀 Deploying pending migrations..."
    run_prisma migrate deploy
    ;;
  reset)
    ensure_database_url
    cat <<'WARN'
⚠️  prisma migrate reset will DROP the database and recreate it from scratch.
    Only use this in local development environments.
WARN
    read -r -p "Type 'reset' to continue: " confirmation
    if [[ "${confirmation}" != "reset" ]]; then
      echo "Aborted."
      exit 0
    fi
    run_prisma migrate reset --force
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    echo "Unknown command: ${COMMAND}" >&2
    usage
    exit 1
    ;;
 esac
