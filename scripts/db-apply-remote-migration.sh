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
LEVELA_AGENT_KEY="${HOME}/.ssh/levela_cursor_agent_ed25519"
_default_vps_host="soc-yeremyan-net"
if [[ -f "${LEVELA_AGENT_KEY}" ]]; then
  _default_vps_host="soc-yeremyan-net-agent"
fi
REMOTE_HOST="${EXPLICIT_REMOTE_DB_HOST:-${REMOTE_DB_HOST:-${_default_vps_host}}}"
REMOTE_DOCKER_DIR="${EXPLICIT_REMOTE_DOCKER_DIR:-${REMOTE_DOCKER_DIR:-/home/ubuntu/supabase-stack/supabase/docker}}"
REMOTE_DB_NAME="${EXPLICIT_REMOTE_DB_NAME:-${REMOTE_DB_NAME:-postgres}}"
REMOTE_DB_USER="${EXPLICIT_REMOTE_DB_USER:-${REMOTE_DB_USER:-postgres}}"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Applying migration on ${REMOTE_HOST}: ${MIGRATION_FILE}"
if ! ssh -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 "${REMOTE_HOST}" "true" 2>/dev/null; then
  echo "" >&2
  echo "SSH to ${REMOTE_HOST} failed in non-interactive mode." >&2
  if [[ "${REMOTE_HOST}" == "soc-yeremyan-net-agent" ]] || [[ -f "${LEVELA_AGENT_KEY}" ]]; then
    echo "For host soc-yeremyan-net-agent: install the automation public key on the VPS (one-time):" >&2
    echo "  ssh-copy-id -i \"\$HOME/.ssh/levela_cursor_agent_ed25519.pub\" -o IdentitiesOnly=yes soc-yeremyan-net" >&2
    echo "Docs: docs/04-operations/dev/VPS_CURSOR_AGENT_SSH.md" >&2
  fi
  if [[ "${REMOTE_HOST}" == "soc-yeremyan-net" ]]; then
    echo "For host soc-yeremyan-net: load ~/.ssh/soc-yeremyan-net into ssh-agent (passphrase key), then retry." >&2
  fi
  echo "Confirm: ssh -o BatchMode=yes ${REMOTE_HOST} 'echo ok'" >&2
  echo "" >&2
  exit 1
fi

ssh -o IdentitiesOnly=yes "${REMOTE_HOST}" \
  "cd ${REMOTE_DOCKER_DIR} && sudo docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ${REMOTE_DB_USER} -d ${REMOTE_DB_NAME}" \
  < "${MIGRATION_FILE}"

echo "Migration applied successfully."
