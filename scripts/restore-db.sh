#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./scripts/restore-db.sh <backup_file>

Restores a PostgreSQL backup created via pg_dump or pg_restore-compatible custom formats.
EOF
}

log() {
  printf '[%s] %s\n' "$(date +"%Y-%m-%dT%H:%M:%S%z")" "$1"
}

fail() {
  log "ERROR: $1"
  exit 1
}

if [ $# -lt 1 ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set. Export the connection string before running this script."
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
  fail "Backup file $BACKUP_FILE does not exist."
fi

log "Restoring database from $BACKUP_FILE..."
case "$BACKUP_FILE" in
  *.sql)
    if ! command -v psql >/dev/null 2>&1; then
      fail "psql is required to restore plain SQL dumps."
    fi
    psql "$DATABASE_URL" < "$BACKUP_FILE"
    ;;
  *.dump|*.tar)
    if ! command -v pg_restore >/dev/null 2>&1; then
      fail "pg_restore is required to restore custom-format dumps."
    fi
    pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$DATABASE_URL" "$BACKUP_FILE"
    ;;
  *)
    fail "Unsupported backup format: $BACKUP_FILE. Provide a .sql, .dump, or .tar file."
    ;;
 esac

log "Restore complete."
