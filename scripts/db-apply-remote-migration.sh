#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.local" ]]; then
  # shellcheck disable=SC1091
  source ".env.local"
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <migration-sql-file>"
  exit 1
fi

MIGRATION_FILE="$1"
REMOTE_HOST="${REMOTE_DB_HOST:-soc-yeremyan-net}"
REMOTE_DOCKER_DIR="${REMOTE_DOCKER_DIR:-~/supabase-stack/supabase/docker}"
REMOTE_DB_NAME="${REMOTE_DB_NAME:-postgres}"
REMOTE_DB_USER="${REMOTE_DB_USER:-postgres}"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Applying migration on ${REMOTE_HOST}: ${MIGRATION_FILE}"
ssh -o IdentitiesOnly=yes "${REMOTE_HOST}" \
  "cd ${REMOTE_DOCKER_DIR} && sudo docker compose exec -T db psql -U ${REMOTE_DB_USER} -d ${REMOTE_DB_NAME}" \
  < "${MIGRATION_FILE}"

echo "Migration applied successfully."
