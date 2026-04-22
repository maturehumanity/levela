#!/usr/bin/env bash
# Applies verifier federation distribution SQL in dependency order via
# scripts/db/apply-remote-migration.sh (SSH + docker compose exec psql).
# Requires a working SSH key to REMOTE_DB_HOST and REMOTE_* vars in .env.local.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

apply_one() {
  local file="$1"
  echo ""
  echo "==> Applying $(basename "${file}")"
  bash "${ROOT_DIR}/scripts/db/apply-remote-migration.sh" "${file}"
}

apply_one "${ROOT_DIR}/supabase/migrations/20260422052000_add_verifier_federation_package_distribution_baseline.sql"
apply_one "${ROOT_DIR}/supabase/migrations/20260422070000_integrate_verifier_federation_distribution_into_execution_and_failover_bundle_gating.sql"
apply_one "${ROOT_DIR}/supabase/migrations/20260422083000_add_verifier_federation_distribution_verification_worker_and_alert_taxonomy.sql"

echo ""
echo "All federation distribution migrations applied (remote)."
