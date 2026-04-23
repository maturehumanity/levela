---
title: Verifier federation operator and signer rotation runbook v0.1
status: draft
owners:
  - governance engineering
  - public audit operations
updated: 2026-04-23
---

# 1. Purpose

Operational steps for **Phase D** of `rollout-plan-v0.1.md` (same folder): rotate verifier mirror **directory signers**, **federation operators**, and **distribution cosigners** without breaking client-verifiable continuity or leaving execution gates stuck in a false “not ready” state.

# 2. Preconditions

- Steward profiles with `current_profile_can_manage_public_audit_verifiers()` (verifier steward path used by the governance UI and RPCs).
- A published verifier mirror directory for the active public audit batch (`governance_public_audit_verifier_mirror_directories` tied to `governance_public_audit_batches`).
- For signing federation distribution packages: every `signer_key` must exist on an **active**, **governance-approved** row in `governance_public_audit_verifier_mirror_directory_signers` (enforced in `sign_governance_public_audit_verifier_federation_package`).
- For **capture**: the directory row used as `source_directory_id` must have its **publisher** (`signer_id` → directory signers) **active** and **governance-approved** (`capture_governance_public_audit_verifier_federation_package`).

# 3. Rotate a directory publisher signer (recommended order)

1. **Register** the new key in `governance_public_audit_verifier_mirror_directory_signers` (steward UI: mirror directory / signer flows), with correct `public_key` and signing algorithm metadata.
2. Run **signer governance** approvals until the new signer row is `governance_status = 'approved'` and `is_active = true` (see signer governance board RPCs and UI).
3. **Publish** a new signed directory row referencing the new signer (`governance_public_audit_verifier_mirror_directories`) for the same batch (or the batch you intend to anchor distribution against), so `governance_public_audit_verifier_federation_package` selects that directory as the effective source.
4. **Re-run federation ops readiness** if your policy requires federation onboarding counts or alerts to be clear (`governance_public_audit_verifier_mirror_federation_operations_summary`).
5. **Capture** a new federation distribution package (`capture_governance_public_audit_verifier_federation_package`). If capture fails with the governance-approved publisher error, the effective directory still points at a signer who is not approved—fix signer governance before retrying.
6. Have **independent approved directory signers** cosign via `sign_governance_public_audit_verifier_federation_package` until `governance_public_audit_verifier_federation_package_distribution_summary` shows `distribution_ready` for your policy thresholds.
7. Optional: run `run_governance_public_audit_verifier_federation_distribution_verification` from the steward UI and resolve any `federation_distribution_*` alerts until ops summaries show verification **fresh** and alert counts at zero where policy demands it.

# 4. Rotate a federation operator (onboarding path)

1. Register or update the operator in `governance_public_audit_verifier_mirror_federation_operators` (steward federation onboarding UI).
2. Drive onboarding requests through **approved** / **onboarded** states so `min_onboarded_federation_operators` and related policy gates stay satisfied.
3. If policy ties readiness to **open critical federation alerts**, resolve or acknowledge alerts per your operational standard so `federation_ops_ready` remains truthful.

# 5. Decommission an old signer

1. Set `is_active = false` or move `governance_status` to `suspended` / `rejected` only **after** no live directory row still references that signer as `signer_id`, and no policy still requires that key for distribution quorum.
2. Re-publish directories and recapture packages as in §3 so clients and gate functions never depend on a retired key.

# 6. Verification continuity checklist

- [ ] Latest directory for the batch lists the intended `directory_hash` and `signer_key`.
- [ ] Publisher signer row: `is_active` + `governance_status = 'approved'`.
- [ ] Latest federation package row exists for `package_scope = 'verifier_federation_distribution'` with expected `package_hash`.
- [ ] Enough **distinct approved** signer keys recorded in `governance_public_audit_verifier_federation_package_signatures` for policy (`distribution_ready`).
- [ ] `governance_public_audit_verifier_federation_distribution_gate` / client bundle path reflects readiness for execution if your deployment wires those gates.
- [ ] **Governance hub (`/governance`)** shows no unexpected federation readiness banner, federation distribution on-call count, activation demographic feed on-call count, or guardian relay on-call count; clear related **Immutable anchoring automation** external execution pages before calling the rotation complete.

# 7. Constitutional and policy mapping (concise)

| Responsibility | Primary schema / RPC | Notes |
|----------------|----------------------|--------|
| Who may steward verifier mirrors, directories, probes | Domain roles + `current_profile_can_manage_public_audit_verifiers()` | Server-side gate on sensitive RPCs. |
| Signed mirror truth for clients | `governance_public_audit_verifier_mirror_directories`, `governance_public_audit_client_verifier_bundle` | Failover and bundle hashes are client-verifiable inputs. |
| Independent signer diversity | Directory trust quorum + failover policy summaries | Feeds bundle gating and federation summaries. |
| Federation operator accountability | `governance_public_audit_verifier_mirror_federation_*` onboarding + alerts | Supports `federation_ops_ready` and alert SLAs. |
| Inter-operator distribution evidence | `governance_public_audit_verifier_federation_packages` + `_package_signatures` | Append-only; signatures restricted to approved directory signer keys. |
| Automated inconsistency handling | `run_governance_public_audit_verifier_federation_distribution_verification`, federation alert scopes | Stale package / bad signature / policy mismatch taxonomy. |

This mapping is **descriptive** (what exists today in schema and RPC names), not a substitute for constitutional text in `docs/03-governance/`.
