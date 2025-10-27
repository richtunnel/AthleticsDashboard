#!/usr/bin/env sh
set -eu

log() {
  printf '[%s] %s\n' "$(date +"%Y-%m-%dT%H:%M:%S%z")" "$1"
}

fail() {
  log "ERROR: $1"
  exit 1
}

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set. Export the connection string before running migrations."
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  fail "pg_dump is required but not installed. Install the PostgreSQL client tools."
fi

if ! command -v yarn >/dev/null 2>&1; then
  fail "yarn is required but not installed. Install Yarn before proceeding."
fi

BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S).sql"
BACKUP_PATH="/tmp/${BACKUP_NAME}"

trap 'log "Migration failed or was interrupted. Backup preserved at $BACKUP_PATH"' INT TERM ERR

log "Creating database backup before migration..."
pg_dump "$DATABASE_URL" > "$BACKUP_PATH"
log "Backup created at $BACKUP_PATH"

log "Checking migration status..."
yarn prisma migrate status

log "Running migrations..."
if yarn prisma migrate deploy; then
  log "Migration completed successfully."
else
  fail "Migration failed. Backup remains at $BACKUP_PATH"
fi

log "Verifying migration status after deploy..."
yarn prisma migrate status

trap - INT TERM ERR

printf '{"event":"database_migration","status":"%s","backup":"%s","timestamp":"%s"}\n' "success" "$BACKUP_PATH" "$(date +%Y-%m-%dT%H:%M:%S%z)"

log "Migration workflow finished. Backup retained at $BACKUP_PATH"
