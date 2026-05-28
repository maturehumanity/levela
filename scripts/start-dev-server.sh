#!/usr/bin/env bash
# Starts the Vite dev server with the Node version from .nvmrc (used by the
# "folder open" VS Code/Cursor task in .vscode/tasks.json).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

load_nvm() {
  if [[ -n "${NVM_DIR:-}" && -s "${NVM_DIR}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "${NVM_DIR}/nvm.sh"
    return 0
  fi
  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    export NVM_DIR="${HOME}/.nvm"
    # shellcheck disable=SC1091
    source "${NVM_DIR}/nvm.sh"
    return 0
  fi
  return 1
}

ensure_node() {
  local required
  required="$(tr -d '[:space:]' < .nvmrc)"

  if load_nvm; then
    if ! nvm install "${required}"; then
      echo "ERROR: Failed to install Node ${required} via nvm." >&2
      exit 1
    fi
    nvm use --silent "${required}"
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js not found. Install Node ${required} (nvm recommended)." >&2
    exit 1
  fi

  node -e "
    const required = process.argv[1].split('.').map(Number);
    const current = process.versions.node.split('.').map(Number);
    const ok =
      current[0] > required[0] ||
      (current[0] === required[0] &&
        (current[1] > required[1] ||
          (current[1] === required[1] && current[2] >= required[2])));
    if (!ok) {
      console.error(
        'ERROR: Node v' + process.versions.node +
        ' is too old. This project requires >= v' + process.argv[1] + '.'
      );
      console.error('Install nvm, then run: nvm install && nvm use');
      process.exit(1);
    }
  " "${required}"
}

ensure_node
exec npm run dev:auto
