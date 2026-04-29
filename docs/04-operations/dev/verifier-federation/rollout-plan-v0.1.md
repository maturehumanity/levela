---
title: Verifier Federation Rollout Plan v0.1
status: draft
owners:
  - governance engineering
  - public audit operations
updated: 2026-04-25
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
- **Phase C.13 (pg_cron guardian relay proof distribution escalation tick)** — Optional **pg_cron** job `guardian_relay_proof_distribution_escalation_tick` (hourly at minute **25**) calls **`gpav_gr_proof_dist_esc_tick`**, which walks the **40** most recently updated **approved** proposals and invokes **`maybe_escalate_guardian_relay_proof_distribution_exec_page`** (no-op unless trust-minimized quorum policy is on and client proof distribution is still not ready). Superuser sessions may run that escalation path and open or refresh **`guardian_relay_proof_distribution_escalation`** external execution paging only (`20260423130000_…sql`).
- **Phase C.14 (pg_cron guardian relay attestation SLA + critical escalation tick)** — Optional **pg_cron** job `guardian_relay_attestation_sla_sync_tick` (hourly at minute **5**) calls **`gpav_gr_attestation_sla_sync_tick`**, which for the same **40** approved proposal window runs **`sync_guardian_relay_attestation_sla_alerts`** then **`maybe_escalate_guardian_relay_critical_public_execution_page`** when open **critical** relay alerts exist. Superuser sessions may run sync/critical escalation and may open or resolve **`relay_attestation_sla`** guardian relay alerts and **`guardian_relay_critical_escalation`** external execution pages only (`20260423140000_…sql`).
- **Phase C.15 (pg_cron public-audit external execution cycle + paging evaluation tick)** — Optional **pg_cron** job `public_audit_external_execution_cycle_tick` (hourly at minute **35**) calls **`gpav_external_execution_cycle_tick`**, which runs `run_governance_public_audit_external_execution_cycle` for the latest batch and then `governance_public_audit_external_execution_paging_summary(auto_open_pages := true)` so stale/failure thresholds can open or refresh `external_execution_sla` paging without steward browser sessions. Superuser-only function grants are scoped to `postgres` / `supabase_admin` (`20260501020000_…sql`).
- **Phase C.16 (automation status telemetry)** — `governance_public_audit_external_execution_automation_status` reports cron registration (`public_audit_external_execution_cycle_tick`) plus latest batch scheduling/page-opening timestamps so stewards can verify autonomous execution health without querying `cron.job` directly (`20260501023000_…sql`); Governance automation panel now surfaces this telemetry in dedicated runtime/last-cycle cards.
- **Phase C.17 (emergency ops rollback guardrails)** — `rollback_governance_emergency_access_ops_policy_to_event` now enforces rollback age and schema-version compatibility guardrails (`max_rollback_age_hours`, `required_policy_schema_version`) before restoring snapshots, and Users admin policy timeline surfaces per-event rollback eligibility so stale/incompatible snapshots are visibly blocked in stewardship UX (`20260501080000_…sql`).
- **Phase C.18 (server-authoritative rollback eligibility feed)** — `governance_emergency_access_ops_policy_event_eligibility` returns per-event rollback eligibility plus reason from backend criteria (event type, schema version, rollback-age window, metadata completeness), and Users admin now consumes that RPC directly so timeline controls stay consistent with rollback enforcement semantics (`20260501082000_…sql`, alias `20260501083000_…sql`).
- **Phase C.19 (cross-operator exchange attestations)** — `governance_public_audit_verifier_federation_exchange_attestations` introduces append-only package exchange accountability events with steward RPC surfaces (`record_governance_public_audit_verifier_federation_exchange`, `governance_public_audit_verifier_federation_exchange_summary`, `governance_public_audit_verifier_federation_exchange_board`); federation distribution controls now let stewards record external operator receipt/verification verdicts and monitor follow-up/rejection counts in-panel (`20260501090000_…sql`).
- **Phase C.20 (exchange receipt verification workflow)** — federation exchange attestations now support optional receipt payload/signature evidence plus explicit stewardship verification (`gpav_verify_federation_exchange_receipt`; long-form verifier RPC also available), and summary/board RPCs expose receipt evidence + pending-verification counts so unresolved cryptographic exchange checks are visible in operations governance (`20260501093000_…sql`, alias `20260501094000_…sql`).
- **Phase C.21 (exchange receipt backlog autonomous escalation)** — `maybe_escalate_verifier_fed_exchange_receipt_page` opens/resolves `verifier_federation_exchange_receipt_escalation` external execution pages from receipt pending-verification backlog metrics, and optional hourly `gpav_fed_exchange_receipt_tick` (minute **55**) keeps this signal fresh without steward browser sessions (`20260501100000_…sql`).
- **Phase C.22 (receipt escalation policy governance + rollback)** — federation receipt backlog escalation is now policy-driven (`gpav_fed_exchange_receipt_policies`) with steward-managed thresholds/channel/enablement (`set_gpav_fed_exchange_receipt_policy`), append-only policy event history (`gpav_fed_exchange_receipt_policy_events` / `gpav_fed_exchange_receipt_policy_event_history`), and rollback safety (`rollback_gpav_fed_exchange_receipt_policy_to_event`); distribution controls now expose policy editing + policy timeline rollback controls (`20260501110000_…sql`).
- **Phase C.23 (receipt age-SLO escalation hardening)** — policy now governs max receipt verification age and stale-backlog critical threshold (`receipt_max_verification_age_hours`, `critical_stale_receipt_count_threshold`); age-bucket analytics (`gpav_fed_exchange_receipt_backlog_age_summary`) feed page severity decisions so stale verification debt can escalate even when raw pending counts are below generic thresholds (`20260501113000_…sql`).
- **Phase C.24 (receipt escalation automation telemetry)** — `gpav_fed_exchange_receipt_automation_status` reports pg_cron registration/activity for `verifier_federation_exchange_receipt_tick`, latest cron run outcome, latest pending/verified receipt timestamps, and latest receipt-escalation page status; federation distribution stewardship UI now surfaces this status block beside receipt escalation policy controls so operators can verify autonomous backlog checks without direct `cron.*` queries (`20260501120000_…sql`).
- **Phase C.25 (receipt automation run ledger + steward trigger)** — receipt escalation automation now writes append-only run records (`gpav_fed_exchange_receipt_automation_runs`) via `run_gpav_fed_exchange_receipt_automation_check`, including lookback, pending/stale counts, critical-backlog flag, and open/ack page count; `gpav_fed_exchange_receipt_tick` now delegates through this run path so cron and manual checks share the same audit trail; stewardship UI exposes a “Run receipt automation check now” action and recent run history for on-call incident reconstruction (`20260501123000_…sql`).
- **Phase C.26 (receipt escalation page incident ops in federation panel)** — federation steward load now carries full `verifier_federation_exchange_receipt` external execution page rows (not only count), and federation distribution controls support in-place acknowledge/resolve actions for open/acknowledged pages so on-call lifecycle can be handled without leaving verifier-federation stewardship (`20260501123000_…sql` UI follow-up).
- **Phase C.27 (receipt escalation incident history analytics)** — federation steward load now queries `governance_public_audit_external_execution_page_history('verifier_federation_exchange_receipt', …)` and federation distribution controls surface 24h open/resolve flow plus unresolved/average-resolution analytics so on-call can detect incident churn and closure regressions without leaving federation controls.

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
- **Activation feed worker escalation auto-resolve** — When the alert summary has no qualifying issues, `maybe_escalate_activation_feed_worker_exec_page` resolves an open or acknowledged `activation_demographic_feed_worker_escalation` page for the batch via `resolve_governance_public_audit_external_execution_page`; resolve failures are non-fatal `NOTICE`s so enqueue passes still complete (`20260502120000_…sql`).
- **External execution HTTPS dispatch (optional)** — After `open_governance_public_audit_external_execution_page` persists a page row, `_dispatch_public_audit_external_execution_page_webhook` POSTs JSON to the default policy `metadata.oncall_webhook_url` when it is an `https://` URL (max 2048 chars) and the **`pg_net`** extension is installed; otherwise it no-ops with a `NOTICE`. The payload uses event `levela.public_audit.external_execution_page_opened` plus page identifiers (no secrets in-database). Dispatch errors never block page open (`20260502130000_…sql`). Verifier stewards can edit the URL from the governance public audit automation policy card; `governance_public_audit_external_execution_policy_summary` exposes `oncall_webhook_url` for load/save (`20260502133000_…sql`).

## 9. Approximate decentralization progress (indicative)

**There is no formula.** The numbers in the table below are **narrative judgments** recorded in this document when milestones land—they are not computed from lines of code, test counts, or migration volume. That is why the figure can sit unchanged while work continues: the authors only move it when they agree a **substantive** program increment (or a deliberate headline clarification like this section) warrants it.

Use two ideas:

1. **Program % (federation rollout, this document §4)** — moves only on **substantive** increments: new schema/RPC/gates, new cross-surface observability or ops workflows, field-hardening sign-off. **Label-only or cosmetic UI polish does not advance this figure.**
2. **Steward polish** — valuable but tracked separately (checklist bullets in §8); it does not inflate program %.

| Scope | Program % (headline) | Rationale |
|------|----------------------|-----------|
| **This rollout plan** (§4 Phases A–D — product, SQL, steward UI, pg_cron ticks **C.12–C.14**) | **~100%** | Implementation and in-database automation for Phases A–D described in this plan are in place, including hourly ticks for federation distribution verification, guardian relay proof-distribution escalation, and guardian relay attestation SLA plus critical escalation. |
| **§2 + §10 — Cross-operator field rehearsal** | **(not scored)** | **§2** still names the organizational gap: *routine* independent-operator exchange and accountability. Closing that is **§10** (named checklist + sign-off), not a missing “1%” on a calculator. |
| **Roadmap §14 slice** (minimized trusted-backend + federation exchange; items 1–5 in §14) | **~72–79%** | Mirror/federation/proof distribution baselines are substantial; activation feed scheduling adds ledger + auto-resolve escalation loop; public audit external execution paging can optionally POST to steward-configured HTTPS webhooks via `pg_net` when enabled, while items 2–3 still need independent-worker / third-party distribution work described in `governance-implementation-roadmap-v0.1.md`. |
| **Roadmap §17** (full decentralization success condition) | **~30–38%** | Civic status, permission refactor, citizen governance UI, founder separation remain major pillars. |

**Headline for steward reports:** federation rollout **implementation ~100%** for this document’s §4 scope (table above). **§10 multi-operator rehearsal** is the remaining **named ops gate** until §2 is satisfied in the field—it is **not** the trailing point of the same percentage.

# 10. Multi-operator rehearsal checklist (field gate)

Use this list when **at least two independent mirror operators** (distinct trust domains or operators, not only two keys in one account) exercise the same public audit batch state. It closes the gap called out in **§2** (inter-operator exchange and accountability) at the **process** layer; schema and UI already exist.

1. **Align on batch scope** — Pick a `governance_public_audit_batches` row (or a short-lived rehearsal batch) and record the batch id in the rehearsal notes.
2. **Directory hash parity** — Both operators publish `governance_public_audit_verifier_mirror_directories` for that batch; confirm `directory_hash` matches or document intentional divergence and expected client behavior.
3. **Digest parity (Phase A)** — Both sides run `governance_public_audit_verifier_federation_pkg_digest_text` / client `digest_source_text` SHA-256 checks on the same captured package payload so `package_hash` is reproducible across operators.
4. **Capture and cosign (Phase B)** — Operator A runs `capture_governance_public_audit_verifier_federation_package`; Operator B (or a second approved signer) runs `sign_governance_public_audit_verifier_federation_package` until `governance_public_audit_verifier_federation_package_distribution_summary` shows **`distribution_ready`** for the rehearsal policy thresholds.
5. **Distribution verification worker** — Each operator runs `run_governance_public_audit_verifier_federation_distribution_verification` (or relies on **`verifier_federation_distribution_verification_tick`** pg_cron) and agrees on alert taxonomy: stale package, bad signature, policy mismatch, and open alert counts trending to **clear** after remediation drills.
6. **External execution paging** — Deliberately breach and clear a **non-production** condition so `verifier_federation_distribution_escalation`, `guardian_relay_proof_distribution_escalation`, `guardian_relay_critical_escalation`, and `activation_demographic_feed_worker_escalation` pages open and resolve as designed; confirm Governance hub (`/governance`) counts and deep links match the batch-bound page board.
7. **Guardian relay automation** — With trust-minimized policy **on** for a rehearsal proposal, exercise capture/sign for `guardian_relay_quorum_client_proof_distribution`, then let **`guardian_relay_proof_distribution_escalation_tick`** and **`guardian_relay_attestation_sla_sync_tick`** run (or invoke `gpav_gr_proof_dist_esc_tick` / `gpav_gr_attestation_sla_sync_tick` manually as `postgres`) and confirm escalations refresh without a steward browser session.
8. **Execution readiness (Phase C.6–C.8)** — On a **non-binding** rehearsal proposal, confirm `governance_proposal_is_execution_ready` and hub banners align with `governance_proposal_meets_verifier_federation_distribution_gate`, federation operations summary, and guardian relay distribution gate diagnostics.
9. **Rotation continuity** — Walk `operator-signer-rotation-runbook-v0.1.md` §3–§6 on paper or in a sandbox tenant so signer governance, publisher rules, and client bundle trust quorum survive one simulated rotation.
10. **Sign-off** — Named operators and a governance steward record date, batch id, package hash, and “rehearsal passed / follow-ups” in your change log or ticket; only then treat **§4 Phase C acceptance** as met in the field.

**Cron cadence reference (when pg_cron is installed):** minute **5** attestation SLA / critical relay tick; minute **15** activation demographic feed worker schedule tick; minute **25** guardian proof-distribution escalation tick; minute **35** public-audit external execution cycle + paging evaluation tick; minute **45** federation distribution verification tick; minute **55** federation exchange receipt verification backlog tick (see §8b and Phases C.12–C.23).
