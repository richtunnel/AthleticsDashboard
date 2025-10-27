#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./scripts/backup-db.sh [output_file]

Creates a PostgreSQL backup using pg_dump. The default output path is ./backups/backup-<timestamp>.sql
EOF
}

log() {
  printf '[%s] %s\n' "$(date +"%Y-%m-%dT%H:%M:%S%z")" "$1"
}

fail() {
  log "ERROR: $1"
  exit 1
}

if [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set. Export the connection string before running this script."
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  fail "pg_dump is required but not installed. Install the PostgreSQL client tools."
fi

OUTPUT_PATH=${1:-"./backups/backup-$(date +%Y%m%d-%H%M%S).sql"}
OUTPUT_DIR=$(dirname "$OUTPUT_PATH")

mkdir -p "$OUTPUT_DIR"

log "Writing database backup to $OUTPUT_PATH..."
pg_dump "$DATABASE_URL" > "$OUTPUT_PATH"
log "Backup complete."
