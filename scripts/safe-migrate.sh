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
  fail "DATABASE_URL is not set. Export the database connection string before running this script."
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  fail "pg_dump is required but not installed. Install the PostgreSQL client tools."
fi

if ! command -v yarn >/dev/null 2>&1; then
  fail "yarn is required but not installed. Install Yarn before proceeding."
fi

log "Checking migration status..."
STATUS_OUTPUT=$(yarn prisma migrate status || true)
printf '%s\n' "$STATUS_OUTPUT"

if ! printf '%s' "$STATUS_OUTPUT" | grep -qi "following migrations have not yet been applied"; then
  log "No pending migrations detected. Database is up to date."
  exit 0
fi

BACKUP_PATH="/tmp/backup-$(date +%Y%m%d-%H%M%S).sql"
trap 'log "Migration failed or was interrupted. Backup preserved at $BACKUP_PATH"' INT TERM ERR

log "Pending migrations detected. Creating backup at $BACKUP_PATH..."
pg_dump "$DATABASE_URL" > "$BACKUP_PATH"
log "Backup completed."

log "Applying pending migrations..."
yarn prisma migrate deploy

log "Verifying migration status after deploy..."
yarn prisma migrate status

trap - INT TERM ERR

printf '{"event":"database_migration","status":"%s","backup":"%s","timestamp":"%s"}\n' "success" "$BACKUP_PATH" "$(date +%Y-%m-%dT%H:%M:%S%z)"

log "Migration successful. Backup retained at $BACKUP_PATH"
