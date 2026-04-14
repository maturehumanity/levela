#!/usr/bin/env bash
set -euo pipefail

EXPLICIT_REMOTE_DB_HOST="${REMOTE_DB_HOST:-}"
EXPLICIT_REMOTE_DOCKER_DIR="${REMOTE_DOCKER_DIR:-}"
EXPLICIT_REMOTE_DB_NAME="${REMOTE_DB_NAME:-}"
EXPLICIT_REMOTE_DB_USER="${REMOTE_DB_USER:-}"

if [[ -f ".env.local" ]]; then
  while IFS='=' read -r raw_key raw_value; do
    [[ -z "${raw_key}" ]] && continue
    key="$(echo "${raw_key}" | tr -d '[:space:]')"
    value="$(echo "${raw_value}" | sed -E "s/^['\"]|['\"]$//g")"
    case "${key}" in
      REMOTE_DB_HOST)
        [[ -z "${EXPLICIT_REMOTE_DB_HOST}" ]] && REMOTE_DB_HOST="${value}"
        ;;
      REMOTE_DOCKER_DIR)
        [[ -z "${EXPLICIT_REMOTE_DOCKER_DIR}" ]] && REMOTE_DOCKER_DIR="${value}"
        ;;
      REMOTE_DB_NAME)
        [[ -z "${EXPLICIT_REMOTE_DB_NAME}" ]] && REMOTE_DB_NAME="${value}"
        ;;
      REMOTE_DB_USER)
        [[ -z "${EXPLICIT_REMOTE_DB_USER}" ]] && REMOTE_DB_USER="${value}"
        ;;
    esac
  done < <(grep -E '^(REMOTE_DB_HOST|REMOTE_DOCKER_DIR|REMOTE_DB_NAME|REMOTE_DB_USER)=' ".env.local")
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <migration-sql-file>"
  exit 1
fi

MIGRATION_FILE="$1"
REMOTE_HOST="${EXPLICIT_REMOTE_DB_HOST:-${REMOTE_DB_HOST:-soc-yeremyan-net}}"
REMOTE_DOCKER_DIR="${EXPLICIT_REMOTE_DOCKER_DIR:-${REMOTE_DOCKER_DIR:-/home/ubuntu/supabase-stack/supabase/docker}}"
REMOTE_DB_NAME="${EXPLICIT_REMOTE_DB_NAME:-${REMOTE_DB_NAME:-postgres}}"
REMOTE_DB_USER="${EXPLICIT_REMOTE_DB_USER:-${REMOTE_DB_USER:-postgres}}"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Applying migration on ${REMOTE_HOST}: ${MIGRATION_FILE}"
ssh -o IdentitiesOnly=yes "${REMOTE_HOST}" \
  "cd ${REMOTE_DOCKER_DIR} && sudo docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ${REMOTE_DB_USER} -d ${REMOTE_DB_NAME}" \
  < "${MIGRATION_FILE}"

echo "Migration applied successfully."
