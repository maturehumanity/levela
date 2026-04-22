#!/usr/bin/env bash
# One-time: push the passphrase-less Levela agent public key to the VPS using
# your normal soc-yeremyan-net (human) SSH session. Requires ssh-copy-id and
# working access to Host soc-yeremyan-net first.
set -euo pipefail
PUB="${HOME}/.ssh/levela_cursor_agent_ed25519.pub"
if [[ ! -f "${PUB}" ]]; then
  echo "Missing ${PUB}. Generate with: ssh-keygen -t ed25519 -f \"\$HOME/.ssh/levela_cursor_agent_ed25519\" -N \"\" -C levela-cursor-agent-local" >&2
  exit 1
fi
exec ssh-copy-id -i "${PUB}" -o IdentitiesOnly=yes soc-yeremyan-net
