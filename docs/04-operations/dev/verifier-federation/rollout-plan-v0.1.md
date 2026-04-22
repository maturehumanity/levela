---
title: Verifier Federation Rollout Plan v0.1
status: draft
owners:
  - governance engineering
  - public audit operations
updated: 2026-04-22
---

# 1. Purpose

This document starts Section 14 Step 5 from the governance implementation roadmap:

- begin distributed mirror-governance and verifier-federation rollout planning

The objective is to convert the current single-cluster stewardship tooling into a federated, independently operated verifier network with client-verifiable package exchange and governance accountability.

# 2. Current Baseline

Already in place:

- signed mirror directories with signer governance
- probe-job scheduling/completion workflows
- federation discovery, onboarding, and operations readiness controls
- trust-minimized guardian relay proof manifests and deterministic verification package distribution signing

Primary remaining gap:

- standardized inter-operator federation package exchange and cross-domain governance accountability for independent mirror operators

# 3. Rollout Principles

1. Keep client verification deterministic and reproducible.
2. Keep all governance-sensitive records append-only where feasible.
3. Minimize privileged trust assumptions by requiring independent operator and signer diversity.
4. Prefer additive migrations and compatibility-preserving RPC evolution.
5. Require observable SLA signals for every autonomous workflow.

# 4. Phase Plan

## Phase A: Federation Contract Surface

Deliverables:

1. Federation package schema for mirror directory exchange and policy snapshots.
2. Signature envelope format for independent operator attestations.
3. Canonical hash/signature validation helpers in server and client parse layers.

Acceptance gates:

1. At least two independent operators can produce byte-identical package hashes from the same source state.
2. Signature envelopes from independent operators validate against the same payload hash.

## Phase B: Multi-Operator Distribution Control Plane

Deliverables:

1. Append-only package publication table and signature board for mirror federation packages.
2. RPCs for publish/sign/list/summary with policy-aware readiness checks.
3. Steward UI controls for package publication and signature tracking.

Acceptance gates:

1. Distribution readiness can be computed from policy thresholds and signature diversity.
2. Package + signature history is queryable without mutation semantics.

## Phase C: Cross-Operator Verification and Failure Handling

Deliverables:

1. Federation verification worker runs and alert channels.
2. Failure taxonomy for stale package, bad signature, and policy mismatch.
3. Escalation rules tied to open critical alerts and stale verification windows.

Acceptance gates:

1. Worker can detect and log federation inconsistencies across operators.
2. Alert and readiness summaries surface blocking failures in steward UI.

## Phase D: Governance Handoff Readiness

Deliverables:

1. Domain-role and signer-governance checks for federated package signers.
2. Runbook for rotating operators/signers without breaking verification continuity (see `docs/04-operations/dev/verifier-federation/operator-signer-rotation-runbook-v0.1.md`).
3. Constitutional and policy mapping for mirror federation responsibilities (summary table in that runbook §7; full constitutional text remains under `docs/03-governance/`).

Acceptance gates:

1. Governance-approved rotation path exists for operators and signers.
2. Rollout can proceed without founder-only operational dependencies.

# 5. First Implementation Slices

The next code slices should implement in this order:

1. `federated verifier package` SQL surface:
`governance_public_audit_verifier_federation_packages`,
`governance_public_audit_verifier_federation_package_signatures`,
and package/signature board RPCs.
2. client/server parse support for federation packages and signatures.
3. steward UI for publish/signature workflows in verifier federation controls.
4. federation package readiness summary integrated into execution gating and mirror failover summaries.

# 6. Risks and Mitigations

Risk: inconsistent hashing between operators.
Mitigation: canonical payload shape/version with deterministic key ordering and schema tests.

Risk: signature concentration under one trust domain.
Mitigation: policy thresholds for distinct trust domains and jurisdictions in readiness checks.

Risk: operational fatigue from alert noise.
Mitigation: severity-scoped alerts, SLA windows, and explicit resolver notes for auditability.

# 7. Exit Criteria for Step 5 Start

Step 5 is considered started when:

1. this rollout plan is checked in and linked from roadmap docs.
2. first migration for federated package distribution surface is opened.
3. corresponding steward UI and parser/hook scaffolding is tracked as immediate follow-up implementation.

# 8. Handoff implementation status

- **Phase A (inter-operator hashing)** — RPC `governance_public_audit_verifier_federation_pkg_digest_text` exposes `digest_source_text` (Postgres `package_payload::text`) so stewards can SHA-256 the same bytes the database used for `package_hash`; client helper `sha256HexFromUtf8` and steward “server digest” check in federation distribution controls (`20260422120000_…sql`, rename `20260422140000_…sql`, app wiring).
- **Phase B (queryable history)** — RPC `governance_public_audit_verifier_federation_dist_pkg_history` returns recent packages for the batch with per-row `signature_count`; steward UI lists “Recent federation packages”.
- **Phase C.3 (escalation)** — `run_governance_public_audit_verifier_federation_distribution_verification` calls `maybe_escalate_verifier_federation_distribution_execution_page` when open distribution alerts remain, opening external execution page `verifier_federation_distribution_escalation` at critical severity.

## Phase D (governance handoff)

- **D.1 Signer governance (cosignatures)** — `sign_governance_public_audit_verifier_federation_package` requires `signer_key` to match an **active**, **governance-approved** `governance_public_audit_verifier_mirror_directory_signers` row (`20260422103000_…sql`).
- **D.1b Publisher governance (capture)** — `capture_governance_public_audit_verifier_federation_package` requires the **published directory** `signer_id` publisher to be **active** and **governance-approved** (`20260422104500_…sql`).
- **D.2 / D.3 Runbook + mapping** — `docs/04-operations/dev/verifier-federation/operator-signer-rotation-runbook-v0.1.md` (rotation procedures and concise policy table).
