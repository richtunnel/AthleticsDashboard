#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./scripts/rollback-migration.sh <migration_name> [backup_file]

Marks the given Prisma migration as rolled back and optionally restores a database backup.

Arguments:
  migration_name  The Prisma migration folder name (e.g., 20250101010101_init)
  backup_file     Optional path to a SQL dump created before the migration
EOF
}

log() {
  printf '[%s] %s\n' "$(date +"%Y-%m-%dT%H:%M:%S%z")" "$1"
}

fail() {
  log "ERROR: $1"
  exit 1
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

MIGRATION_NAME=$1
BACKUP_FILE=${2:-}

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set. Export the connection string before running this script."
fi

if ! command -v yarn >/dev/null 2>&1; then
  fail "yarn is required but not installed. Install Yarn before proceeding."
fi

log "Marking migration ${MIGRATION_NAME} as rolled back..."
yarn prisma migrate resolve --rolled-back "$MIGRATION_NAME"
log "Migration ${MIGRATION_NAME} marked as rolled back."

if [ -n "$BACKUP_FILE" ]; then
  if [ ! -f "$BACKUP_FILE" ]; then
    fail "Backup file $BACKUP_FILE does not exist."
  fi

  if ! command -v psql >/dev/null 2>&1 && ! command -v pg_restore >/dev/null 2>&1; then
    fail "psql or pg_restore is required to restore the backup."
  fi

  log "Restoring database from backup $BACKUP_FILE..."
  case "$BACKUP_FILE" in
    *.sql)
      if command -v psql >/dev/null 2>&1; then
        psql "$DATABASE_URL" < "$BACKUP_FILE"
      else
        fail "psql is required to restore plain SQL dumps."
      fi
      ;;
    *.dump|*.tar)
      if command -v pg_restore >/dev/null 2>&1; then
        pg_restore --no-owner --no-privileges --dbname="$DATABASE_URL" "$BACKUP_FILE"
      else
        fail "pg_restore is required to restore custom-format dumps."
      fi
      ;;
    *)
      fail "Unsupported backup format: $BACKUP_FILE. Provide a .sql, .dump, or .tar file."
      ;;
  esac
  log "Backup restore complete."
else
  log "No backup file provided. Skipping restore step."
fi

log "Rollback procedure complete."
