#!/usr/bin/env bash

set -euo pipefail

STRICT_MODE="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(cd "$ROOT_DIR/.." && pwd)"
LEGACY_DIR="${LEVELA_LEGACY_DIR:-$PARENT_DIR/levela}"

normalize_remote() {
  echo "$1" \
    | sed -E 's#^[^:]+://##; s#^[^@]+@##; s#^[^:]+:##; s#^github.com/##; s#^[^/]+/##; s#\.git$##'
}

if [ ! -d "$LEGACY_DIR/.git" ]; then
  exit 0
fi

CANONICAL_REMOTE="$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null || true)"
LEGACY_REMOTE="$(git -C "$LEGACY_DIR" remote get-url origin 2>/dev/null || true)"
CANONICAL_REMOTE_NORMALIZED="$(normalize_remote "$CANONICAL_REMOTE")"
LEGACY_REMOTE_NORMALIZED="$(normalize_remote "$LEGACY_REMOTE")"

if [ -z "$CANONICAL_REMOTE" ] || [ -z "$LEGACY_REMOTE" ]; then
  exit 0
fi

if [ "$CANONICAL_REMOTE_NORMALIZED" != "$LEGACY_REMOTE_NORMALIZED" ]; then
  exit 0
fi

CANONICAL_BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
LEGACY_BRANCH="$(git -C "$LEGACY_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
CANONICAL_HEAD="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || true)"
LEGACY_HEAD="$(git -C "$LEGACY_DIR" rev-parse --short HEAD 2>/dev/null || true)"

if [ -z "$CANONICAL_HEAD" ] || [ -z "$LEGACY_HEAD" ]; then
  exit 0
fi

if [ "$CANONICAL_HEAD" = "$LEGACY_HEAD" ] && [ "$CANONICAL_BRANCH" = "$LEGACY_BRANCH" ]; then
  exit 0
fi

{
  echo "[workspace-check] Potential workspace drift detected."
  echo "  canonical: $ROOT_DIR ($CANONICAL_BRANCH @ $CANONICAL_HEAD)"
  echo "  legacy:    $LEGACY_DIR ($LEGACY_BRANCH @ $LEGACY_HEAD)"
  echo "  both folders point to the same remote ($CANONICAL_REMOTE) but differ locally."
  echo "  recommendation: use '$ROOT_DIR' as the source of truth for Lovable sync and Android release builds."
} >&2

if [ "$STRICT_MODE" = "--strict" ]; then
  {
    echo "[workspace-check] strict mode failed to prevent publishing from a drifted workspace context."
    echo "[workspace-check] resolve by archiving/symlinking '$LEGACY_DIR' or syncing it to the same branch/commit first."
  } >&2
  exit 1
fi

exit 0
