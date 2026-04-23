---
title: Verifier Federation Rollout Plan v0.1
status: draft
owners:
  - governance engineering
  - public audit operations
updated: 2026-04-23
---

# 1. Purpose

This document starts **Section 14, Step 5** from the parent roadmap:

- [Governance implementation roadmap v0.1](../governance-implementation-roadmap-v0.1.md) (see **Immediate Next Steps** and the Step 5 kickoff line in that file)

Concrete scope for this artifact:

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
- **Phase C.12 (pg_cron distribution verification tick)** — Optional **pg_cron** job `verifier_federation_distribution_verification_tick` (hourly at minute **45**) calls **`gpav_federation_dist_verification_cron_tick`** (short Postgres-safe symbol; avoids 63-char name collision with `run_governance_public_audit_verifier_federation_distribution_verification`), which runs the same distribution verification path as stewards under a **superuser-only** entrypoint with narrow authorization for distribution federation alert scopes, `package_distribution_verification` worker runs, and `verifier_federation_distribution_escalation` external execution paging (`20260423120000_…sql`, repair `20260423121000_…sql` if upgrading from the first apply).

## Phase D (governance handoff)

- **D.1 Signer governance (cosignatures)** — `sign_governance_public_audit_verifier_federation_package` requires `signer_key` to match an **active**, **governance-approved** `governance_public_audit_verifier_mirror_directory_signers` row (`20260422103000_…sql`).
- **D.1b Publisher governance (capture)** — `capture_governance_public_audit_verifier_federation_package` requires the **published directory** `signer_id` publisher to be **active** and **governance-approved** (`20260422104500_…sql`).
- **D.2 / D.3 Runbook + mapping** — `docs/04-operations/dev/verifier-federation/operator-signer-rotation-runbook-v0.1.md` (rotation procedures and concise policy table).
- **Phase C.1 (worker run observability)** — Steward UI loads recent `governance_public_audit_verifier_mirror_federation_worker_runs` rows and lists them on the federation card.
- **Phase C.4 (steward-facing copy)** — Human labels for federation alerts, worker runs, discovery/onboarding/signer previews, distribution gate summary on the failover policy card, mirror trust tiers, and probe job lifecycle (ongoing polish).
- **Phase C.5 (escalation cross-surface observability)** — Federation steward load path counts **open or acknowledged** external execution pages whose `page_key` contains `verifier_federation_distribution` (from `governance_public_audit_external_execution_page_board`), surfacing distribution verification on-call escalations next to federation summaries without opening the automation card first.
- **Phase C.6 (governance execution cross-surface)** — Governance hub loads mirror failover policy plus `governance_proposal_meets_verifier_federation_distribution_gate` when the default policy requires federation ops readiness; shows an amber banner when distribution is not ready, and blocks **Run implementation** until `governance_proposal_is_execution_ready` is true (aligns client path with SQL execution gate).
- **Phase C.7 (execution gate diagnostics)** — When **Run implementation** is blocked because `governance_proposal_is_execution_ready` is false, the hub re-checks threshold, guardian sign-off, verifier federation distribution gate, and guardian relay distribution gate so the steward sees **which** condition is still pending instead of a single blended message.
- **Phase C.8 (governance federation operations banner)** — Governance hub also loads `governance_public_audit_verifier_mirror_federation_operations_summary` when evaluating federation execution risk; the amber banner appears if the package distribution gate **or** live federation operations readiness is red, with short human hints for operators, critical alerts, alert ageing, stale distribution verification runs, and open distribution verification alerts.
- **Phase C.9 (guardian relay escalation cross-surface on Governance)** — Governance hub load path reuses `governance_public_audit_external_execution_page_board` (latest batch) and counts **open or acknowledged** pages whose `page_key` contains `guardian_relay`, surfacing proof-distribution and critical relay escalations next to proposals without opening Guardian relays or automation first.
- **Phase C.10 (federation distribution escalation cross-surface on Governance)** — Same external execution page board response also counts pages whose `page_key` contains `verifier_federation_distribution`, so federation distribution on-call escalations appear on the Governance hub with **no extra RPC** beyond Phase C.9.
- **Steward polish (governance hub alerts)** — Federation readiness, federation distribution escalation, guardian relay escalation, and activation demographic feed escalation cards on `/governance` link into governance admin with fragment ids; the stewardship screen exposes matching anchors (`stewardship-public-audit-tools`, `stewardship-activation-review`) and scrolls into view when the hash is present.
- **Steward polish (execution page board paging)** — Governance hub, verifier federation steward load, and immutable anchoring automation hooks share **`GOVERNANCE_PUBLIC_AUDIT_EXTERNAL_EXECUTION_PAGE_BOARD_MAX_PAGES` (120)** for `governance_public_audit_external_execution_page_board` so high-churn batches surface more open pages before client-side truncation.
- **Steward polish (stewardship hash scroll layout)** — Public audit anchoring and Activation stewardship anchor cards use Tailwind **`scroll-mt-24`** so in-app fragment navigation clears typical sticky chrome.
- **Phase C.11 (activation demographic feed escalation on Governance)** — Same external execution page board counts **open or acknowledged** pages whose `page_key` contains `activation_demographic_feed` (worker escalation); stewardship deep link uses `#stewardship-activation-review` on the Activation stewardship card, and Governance admin scrolls smoothly to the matching hash when present.
- **Steward polish (governance hub execution board batch binding)** — Before paging external execution pages, the Governance hub resolves the latest `governance_public_audit_batches.id` (same ordering as anchoring UI) and passes **`requested_batch_id`** into `governance_public_audit_external_execution_page_board` when present, so on-call escalation counts stay tied to the visible latest batch row instead of relying only on the RPC default.

## 8b. Related roadmap §14.1 (signed demographic feeds)

- **Activation feed worker schedule tick escalation** — `schedule_activation_demographic_feed_worker_jobs_impl` ends each enqueue pass with `maybe_escalate_activation_feed_worker_exec_page` (payload `source: schedule_activation_demographic_feed_worker_jobs_impl`, default 24h freshness window) so **pg_cron** and steward-driven scheduling refresh `activation_demographic_feed_worker_escalation` external execution paging when alert summaries remain red. Superuser database sessions may run that escalation path and open that page key only (narrow automation carve-out; `20260423100000_…sql`).

## 9. Approximate decentralization progress (indicative)

Percentages are **not precise engineering metrics**. Use two ideas:

1. **Program % (federation rollout, this document §4)** — moves only on **substantive** increments: new schema/RPC/gates, new cross-surface observability or ops workflows, field-hardening sign-off. **Label-only or cosmetic UI polish does not advance this figure.**
2. **Steward polish** — valuable but tracked separately (checklist bullets in §8); it does not inflate program %.

| Scope | Program % (headline) | Rationale |
|------|----------------------|-----------|
| **This rollout plan** (§4 Phases A–D) | **~98%** | Phase C.12 adds an hourly pg_cron tick for federation package distribution verification (alerts, worker runs, external execution escalation) without a browser session, with superuser-only automation hooks aligned to distribution alert scopes; remaining work is multi-operator rehearsal and production follow-ups. |
| **Roadmap §14 slice** (minimized trusted-backend + federation exchange; items 1–5 in §14) | **~66–73%** | Mirror/federation/proof distribution baselines are substantial; items 1–3 still carry partial / productionize language in `governance-implementation-roadmap-v0.1.md`. |
| **Roadmap §17** (full decentralization success condition) | **~30–38%** | Civic status, permission refactor, citizen governance UI, founder separation remain major pillars. |

**Headline for steward reports:** federation rollout program **98%** (this table). Overall product decentralization remains **early-to-mid** until §17 criteria advance.
