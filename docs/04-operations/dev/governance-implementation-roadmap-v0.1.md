---
content_id: governance-implementation-roadmap-v0-1
title: Governance Implementation Roadmap v0.1
content_category: system_operations
moderation_lane: moderated
content_type: runbook
professional_domain: technology
contribution_policy: staff_only
owner_role: founder
review_status: draft
---

# Governance Implementation Roadmap v0.1

## 1. Purpose

This roadmap turns the current governance draft set into an implementation sequence for the actual Levela codebase. It maps constitutional and policy concepts to:

- schema changes
- role and permission model changes
- UI and route changes
- operational rollout phases
- testing requirements

## 2. Source Documents

The policy source of truth for this roadmap is currently:

- `docs/02-moderated/legal/levela_terms_of_use.md`
- `docs/02-moderated/legal/levela_constitution_v0_1.md`
- `docs/02-moderated/policies/citizenship_and_verification_policy_v0_1.md`
- `docs/03-governance/founder-role-charter-v0.2.md`
- `docs/03-governance/role-domains-and-maturity-thresholds-v0.1.md`
- `docs/03-governance/citizen-status-model-v0.1.md`
- `docs/03-governance/governance-permission-model-v0.1.md`
- `docs/03-governance/country-activation-framework-v0.1.md`
- `docs/03-governance/advisory-high-council-model-v0.1.md`

## 3. Current Codebase Snapshot

### 3.1 Current identity and role model

Current profile and role state is centered in:

- `public.profiles`
- `src/contexts/AuthContext.tsx`
- `src/lib/access-control.ts`
- `supabase/migrations/20260327213000_add_role_based_access_control.sql`
- `supabase/migrations/20260413102000_add_citizen_role_and_refresh_content_rules.sql`

The current role model is still a product-era model:

- `guest`
- `member`
- `citizen`
- `verified_member`
- `certified`
- `moderator`
- `market_manager`
- `admin`
- `founder`
- `system`

### 3.2 Current governance state

Governance storage is currently concentrated in:

- `monetary_policy_profiles`
- `monetary_policy_approvals`
- `monetary_policy_audit_events`
- `governance_action_intents`

The current governance screen is:

- `src/pages/settings/GovernanceAdmin.tsx`

This screen is still mounted under an admin route:

- `/settings/admin/governance`

### 3.3 Current gaps

The codebase does not yet have first-class storage for:

- citizenship acceptance timing
- active citizen status
- governance-eligible status
- domain-based stewardship roles
- role maturity thresholds
- sanctions and governance blocks
- identity verification case workflow
- country activation review workflow
- founder office separated from blanket founder permissions
- advisory or constitutional council membership

## 4. Design Rules For Implementation

These rules should govern all implementation work:

1. Separate public reputation from governance eligibility.
2. Keep `1 eligible citizen = 1 vote` as the default.
3. Make minimum Levela score mandatory for governance rights.
4. Treat Founder as constitutional office, not blanket super-admin.
5. Decentralize by domain, not by one big switch.
6. Keep sensitive identity data off-chain and minimally accessible.
7. Prefer append-only and auditable governance state for sensitive actions.

## 5. Policy Concept To Implementation Map

### 5.1 Registered Member

Current state:

- already exists through `profiles` and auth signup flow

Needed implementation:

- no major new state required
- ensure this remains the default onboarding state

Likely code surfaces:

- `src/pages/auth/SignUp.tsx`
- `src/contexts/AuthContext.tsx`

### 5.2 Verified Member

Current state:

- partially represented by `profiles.is_verified`

Needed implementation:

- add structured verification case workflow instead of only a boolean
- preserve `is_verified` as a fast-read projection

Recommended schema:

- `identity_verification_cases`
- `identity_verification_artifacts`
- `identity_verification_reviews`

### 5.3 Citizen

Current state:

- partially overloaded into `profiles.role = citizen`

Needed implementation:

- separate citizenship status from role
- store acceptance timing and review path

Recommended schema:

- add to `profiles`:
  - `citizenship_status`
  - `citizenship_accepted_at`
  - `citizenship_acceptance_mode`
  - `citizenship_review_cleared_at`

Recommended projection rule:

- role should no longer be the sole source of civic status

### 5.4 Active Citizen

Current state:

- does not exist as first-class state

Needed implementation:

- add active citizenship state separate from verified and citizen
- allow country and later world activation scope

Recommended schema:

- add to `profiles`:
  - `is_active_citizen`
  - `active_citizen_since`
- add new table:
  - `citizen_activation_scopes`
    - `profile_id`
    - `scope_type` such as `country` or `world`
    - `country_code`
    - `activated_at`

### 5.5 Governance-Eligible Citizen

Current state:

- only partially modeled in frontend logic inside `GovernanceAdmin.tsx`

Needed implementation:

- move from client-only derived state toward persisted eligibility snapshot plus server-side checks

Recommended schema:

- `governance_eligibility_snapshots`
  - `profile_id`
  - `levela_score`
  - `governance_score`
  - `eligible`
  - `reason_codes`
  - `calculated_at`
  - `calculation_version`

Recommended projection fields:

- add to `profiles`:
  - `is_governance_eligible`
  - `governance_eligible_at`

### 5.6 Founder Office

Current state:

- `founder` is just a role with blanket permissions

Needed implementation:

- separate constitutional office from ordinary application permissions

Recommended schema:

- add to `profiles`:
  - `constitutional_office`
- or better:
  - `constitutional_offices`
    - `office_key`
    - `profile_id`
    - `assigned_at`
    - `is_active`

Recommended initial office values:

- `founder`

Implementation rule:

- remove long-term dependence on `founder: [...APP_PERMISSIONS]` in `src/lib/access-control.ts`

### 5.7 Domain Stewardship Roles

Current state:

- current roles are broad and product-oriented

Needed implementation:

- add governance domain roles independent from civic status

Recommended schema:

- `governance_domains`
- `governance_domain_roles`
- `profile_governance_roles`
- `governance_role_requirements`

Suggested initial domain keys:

- `identity_verification`
- `moderation_conduct`
- `constitutional_review`
- `policy_legal`
- `treasury_finance`
- `market_oversight`
- `technical_stewardship`
- `dispute_resolution`
- `security_incident_response`
- `civic_education`
- `activation_review`

### 5.8 Maturity Thresholds

Current state:

- policy only, not in schema

Needed implementation:

- store domain thresholds and current maturity status

Recommended schema:

- `governance_domain_maturity_thresholds`
- `governance_domain_maturity_snapshots`

### 5.9 Country Activation

Current state:

- policy only

Needed implementation:

- activation review workflow and auditable declaration state

Recommended schema:

- `activation_threshold_reviews`
- `activation_evidence`
- `activation_decisions`

Suggested fields:

- jurisdiction scope
- target population source
- verified count
- threshold percent
- review state
- declared_at

### 5.10 Advisory / High Council

Current state:

- policy only

Needed implementation:

- membership and standing model

Recommended schema:

- `constitutional_bodies`
- `constitutional_body_memberships`
- `constitutional_body_actions`

## 6. Permission Model Refactor

### 6.1 Current problem

Current permissions in `src/lib/access-control.ts` are too broad for the new civic design, especially:

- `role.assign`
- `settings.manage`
- founder blanket permission inheritance

### 6.2 Target structure

Keep application permissions for ordinary UI and content management, but add governance-specific permissions such as:

- `governance.vote.ordinary`
- `governance.propose.ordinary`
- `governance.review.ordinary`
- `governance.vote.constitutional`
- `governance.review.constitutional`
- `identity.verify`
- `identity.review.appeal`
- `activation.review`
- `treasury.review`
- `treasury.audit`
- `security.respond`
- `dispute.review`

### 6.3 Founder transition rule

Founder should no longer permanently derive all permissions from a single app role. Founder access should instead come from:

- constitutional office
- temporary bootstrap domain stewardship
- explicit audit and integrity rights

## 7. UI And Route Map

### 7.1 Existing surfaces to modify

- `src/pages/auth/SignUp.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Home.tsx`
- `src/pages/Settings.tsx`
- `src/pages/TermsOfUse.tsx`
- `src/pages/settings/UsersAdmin.tsx`
- `src/pages/settings/GovernanceAdmin.tsx`
- `src/pages/settings/Professions.tsx`

### 7.2 New user-facing surfaces to add

- `Citizenship Status` page
- `Governance Eligibility` page
- `Identity Verification` flow page
- `Governance Proposals` page
- `Governance Voting` page
- `Activation Status` page

### 7.3 New steward-facing surfaces to add

- `Identity Review` console
- `Activation Review` console
- `Governance Role Stewardship` console
- `Council / Constitutional Body` console

### 7.4 Navigation changes

Current `adminGovernance` route should eventually split into:

- citizen-facing governance area
- steward-facing governance operations area

The citizen-facing governance area should not remain only an admin route.

## 8. Schema Rollout Phases

### Phase 1. Civic status normalization

Goal:

- separate civic status from product role

Changes:

- add citizenship, active, and governance-eligible fields
- add governance eligibility snapshot table
- preserve current role field as compatibility layer

### Phase 2. Verification workflow

Goal:

- replace bare verification boolean with structured review flow

Changes:

- add verification case tables
- project final state back to `profiles.is_verified`

### Phase 3. Founder office and domain roles

Goal:

- separate constitutional office from all-powerful app role

Changes:

- add office and domain-role tables
- reduce founder blanket permissions

### Phase 4. Governance participation model

Goal:

- support citizen-facing proposals, voting, and review

Changes:

- add proposal, vote, quorum, and ratification tables
- make governance action intents part of normal proposal lifecycle

### Phase 5. Activation and maturity

Goal:

- allow country/world activation and domain transition

Changes:

- add activation review tables
- add maturity threshold and maturity snapshot tables

## 9. Proposed Migration Order

1. add civic status columns and governance eligibility snapshot table
2. add verification case tables
3. add sanctions and governance block state
4. add constitutional office and domain role tables
5. add proposal and voting tables
6. add activation and maturity tables
7. refactor permissions and route guards

## 10. Required Server-Side Enforcement

The current frontend checks are useful but insufficient long-term.

The system should move critical governance enforcement into:

- RLS policies
- SQL functions
- signed-intent verification flows
- server-side eligibility checks

Critical actions that must not stay client-only:

- governance eligibility determination
- governance role assignment
- proposal creation in reserved domains
- constitutional review access
- activation declaration

## 11. Testing Requirements

### 11.1 Unit tests

- score to governance-eligibility calculation
- founder office normalization rules
- civic status transition logic
- permission resolution logic

### 11.2 Integration tests

- verified member to citizen transition
- citizen to active citizen activation
- governance eligibility gating
- domain maturity threshold transition

### 11.3 Security tests

- private data isolation
- founder access logging
- no governance writes from ineligible users
- no bypass of mobile governance path where required

## 12. Immediate Repo Backlog

The highest-signal next engineering backlog for this repository is:

1. add first-class civic status fields and tables
2. create a reusable governance eligibility service backed by database snapshots
3. separate founder office from founder app super-role
4. add a citizen-facing governance entry point instead of admin-only governance
5. add identity verification workflow tables and UI
6. harden sanctions reporting, notification, and appeals analytics on top of sanctions/governance-block enforcement
7. add proposal and vote tables

## 13. Current Implementation Status

The repository has now completed a substantial portion of the early roadmap.

Implemented:

- civic status normalization fields and projections
- governance eligibility snapshots and gating logic
- identity verification workflow tables and UI flow
- citizen-facing governance route with proposals and voting
- governance execution units and implementation queue
- governed execution adapters for permissions, memberships, verification, activation, monetary policy, certification, and content state
- sanctions and governance-block state with server-side enforcement in proposal creation, voting, verification review, and execution paths
- steward-facing sanctions management tooling and citizen appeal workflow on top of sanctions/governance-block enforcement
- constitutional office normalization bootstrap (`constitutional_offices`) with founder office backfill and helper functions
- founder app-role hardening from blanket superuser inheritance to explicit founder baseline permissions
- governance domain-role normalization (`governance_domains`, `governance_domain_roles`, `profile_governance_roles`) with bootstrap backfill from execution-unit memberships
- sensitive governance-adjacent policies rerouted from unit-key checks to domain stewardship checks
- activation review workflow tables (`activation_threshold_reviews`, `activation_evidence`, `activation_decisions`) with declaration-gated activation controls
- steward-facing activation review console with decision logging and demographic snapshot ingestion automation (`activation_demographic_snapshots`, `capture_activation_demographic_snapshot`, `capture_scheduled_activation_demographic_snapshots`)
- signed external activation feed adapter layer (`activation_demographic_feed_adapters`, `activation_demographic_feed_ingestions`, `ingest_signed_activation_demographic_feed_snapshot`) with signature-verification-assisted steward ingestion
- adapter worker run + alerting baseline for signed demographic feeds (`activation_demographic_feed_worker_runs`, `record_activation_demographic_feed_worker_run`, `resolve_activation_demographic_feed_worker_alerts`, `activation_demographic_feed_worker_alert_summary`) with steward-facing sweep controls and freshness/signature-failure surfacing
- maturity threshold and snapshot workflow tables (`governance_domain_maturity_thresholds`, `governance_domain_maturity_snapshots`) with baseline threshold seeding and founder-exit-aware domain access checks
- maturity workflow hardening with scheduled/event-driven snapshot refresh automation, steward review UI surfaces, and transition observability (`governance_domain_maturity_transitions`)
- sensitive execution threshold rules (`governance_execution_threshold_rules`) with server-side approval gating for proposal ratification and execution readiness
- guardian signer approval tracks for critical proposals (`governance_proposal_guardian_approvals`) with execution-readiness enforcement on guardian-threshold actions
- external guardian multisig infrastructure baseline (`governance_guardian_multisig_policies`, `governance_guardian_external_signers`, `governance_proposal_guardian_external_signatures`) with proposal-level external signoff attestations and guardian-summary integration
- public audit batching and anchor recording baseline (`governance_public_audit_batches`, `governance_public_audit_batch_items`) with hash-chain verification workflow
- guardian external multisig cryptographic verification path (`verifyExternalGuardianSignature`, `hashExternalSignedMessage`) wired into steward signoff capture
- replicated public-audit verifier infrastructure (`governance_public_audit_replication_policies`, `governance_public_audit_verifier_nodes`, `governance_public_audit_batch_verifications`, `governance_public_audit_network_proofs`) with steward UI and batch-level threshold summaries
- guardian relay quorum + chain-proof reconciliation layer (`governance_guardian_relay_policies`, `governance_guardian_relay_nodes`, `governance_proposal_guardian_relay_attestations`, `governance_proposal_guardian_relay_summary`) integrated into guardian-threshold execution readiness
- guardian relay diversity + attestation audit reporting baseline (`min_distinct_relay_*` policy thresholds, relay region/provider/operator/trust metadata, `governance_proposal_guardian_relay_diversity_audit`, `governance_proposal_guardian_relay_attestation_audit_report`, `governance_guardian_relay_audit_reports`) with steward capture snapshots and per-relay health surfaces
- trust-minimized relay quorum + client-verifiable guardian proof manifest baseline (`governance_proposal_guardian_relay_trust_minimized_summary`, `governance_proposal_guardian_relay_client_proof_manifest`, `governance_proposal_client_verification_manifests`, `capture_governance_proposal_guardian_relay_client_manifest`) with jurisdiction/trust-domain diversity and concentration-threshold policy surfaces
- deterministic client-verification package + distribution signing baseline for guardian relay proofs (`governance_proposal_client_verification_packages`, `governance_proposal_client_verification_package_signatures`, `governance_proposal_guardian_relay_client_verification_package`, `capture_governance_proposal_guardian_relay_client_verification_package`, `sign_governance_proposal_guardian_relay_client_verification_package`) with steward-facing package/signature distribution workflows
- immutable public-audit anchoring adapter + external execution orchestration baseline (`governance_public_audit_anchor_adapters`, `governance_public_audit_immutable_anchors`, `governance_public_audit_anchor_execution_jobs`, `governance_public_audit_verifier_jobs`, `schedule_governance_public_audit_anchor_execution_jobs`, `complete_governance_public_audit_anchor_execution_job`, `run_governance_public_audit_external_execution_cycle`, `schedule_governance_public_audit_verifier_jobs`, `complete_governance_public_audit_verifier_job`) with operations SLA dashboard summaries (`governance_public_audit_operations_sla_summary`, `governance_public_audit_anchor_execution_job_board`)
- immutable-anchor external execution worker production hardening (`governance_public_audit_external_execution_policies`, `governance_public_audit_external_execution_pages`, `governance_public_audit_external_execution_policy_summary`, `set_governance_public_audit_external_execution_policy`, `claim_governance_public_audit_external_execution_jobs`, `governance_public_audit_external_execution_paging_summary`, `governance_public_audit_external_execution_page_board`) with retry/backoff policy controls, queue-draining claim runtimes, and on-call paging workflows
- replaceable public-audit verifier mirror baseline (`governance_public_audit_verifier_mirrors`, `governance_public_audit_verifier_mirror_checks`, `governance_public_audit_verifier_mirror_health_summary`, `governance_public_audit_client_verifier_bundle`) with steward mirror health reporting and client-bundle hash surfacing
- verifier-mirror productionization baseline (`governance_public_audit_verifier_mirror_directory_signers`, `governance_public_audit_verifier_mirror_directories`, `governance_public_audit_verifier_mirror_failover_policies`, `governance_public_audit_verifier_mirror_probe_jobs`, `governance_public_audit_verifier_mirror_probe_job_summary`, `governance_public_audit_verifier_mirror_probe_job_board`) with signed-directory publication, configurable client failover policy, and probe-job scheduling/completion flows in steward UI
- signed directory trust-quorum baseline (`governance_public_audit_verifier_mirror_directory_attestations`, `governance_public_audit_verifier_mirror_directory_trust_summary`, `set_governance_public_audit_verifier_mirror_min_independent_signers`, `record_governance_public_audit_verifier_mirror_directory_attestation`) with independent-signer threshold policy surfaces and client-bundle trust-quorum gating
- governance and admin UI refactors needed to keep the active implementation maintainable
- engineering standards enforcement for file size and ongoing code health

Partially implemented:

- signed governance support exists in bootstrap form, but is not yet the sole enforcement path for all sensitive actions
- activation workflow now includes steward consoles, automated snapshot ingestion, signed external feed adapter ingestion, and worker sweep/feed-health alerting baseline, but production scheduler hardening and paging/escalation integration are not yet complete
- governance execution is now threshold-backed with guardian signoff, cryptographic external signatures, relay quorum/chain-proof reconciliation, diversity/audit reporting baselines, and production relay operations hardening (worker runs, quorum-health alerting, trust-minimized + ops-readiness policy gates), but third-party verifier interoperability and deterministic client verification package distribution are not yet complete
- public audit and replicated-state anchoring now include immutable anchor adapters, external execution worker orchestration, queue-draining claim runtimes, retry/backoff controls, and on-call paging baselines, but distributed worker runtime deployment and autonomous escalation integrations are not yet complete
- trust-minimized relay quorum and client-verifiable governance proof surfaces now include baseline policy thresholds, append-only manifest capture, deterministic verification package snapshots, and distribution signing baselines, but third-party verifier interoperability and federated verifier package exchange are not yet complete
- minimized trusted-backend rollout now includes replaceable verifier mirror registration, signed directory publication, failover-policy configuration, probe-job automation, signed-directory trust-quorum baselines, autonomous mirror-discovery federation sources/candidates, federated mirror-policy ratification baselines, independent directory-signer governance attestations/approval workflows, client-bundle federation diversity quorum gating for distinct operator/region thresholds, and externally operated multi-operator federation onboarding plus operations-hardening workflows
- distributed verifier-federation package distribution baseline now includes append-only package capture/signature ledgers and deterministic package/signature summary surfaces (`governance_public_audit_verifier_federation_packages`, `governance_public_audit_verifier_federation_package_signatures`, `governance_public_audit_verifier_federation_package`, `capture_governance_public_audit_verifier_federation_package`, `sign_governance_public_audit_verifier_federation_package`)

Not yet implemented:

- immutable public-state anchoring adapters with independent verifier automation
- minimized trusted-backend model with broadly distributed client-verifiable governance proofs

## 14. Immediate Next Steps

The next implementation sequence should now be:

1. productionize adapter worker scheduling and escalation routing for signed demographic feeds on top of the new worker + alerting baseline
2. productionize guardian relay diversity + attestation audit reporting with independent workers, stronger anti-concentration policy enforcement, and quorum-health SLA alerting
3. productionize trust-minimized relay quorum and client-verifiable governance proof distribution on top of the new manifest baseline
4. productionize minimized trusted-backend rollout with signed verifier mirror directories, autonomous health probing, and client-side mirror failover policy
5. begin distributed mirror-governance and verifier-federation rollout planning

Step 5 kickoff artifact: `docs/04-operations/dev/verifier-federation-rollout-plan-v0.1.md`

## 15. Suggested Ownership Sequence

To keep implementation coherent, work in this order:

1. schema normalization
2. server-side eligibility enforcement
3. role and permission refactor
4. citizen-facing governance UI
5. steward consoles
6. activation and maturity workflows

## 16. Continuation Note

This roadmap is now the best repo-native handoff point for continuation. A new chat can resume effectively from the current codebase if it is directed to:

- continue Levela decentralization from `docs/04-operations/dev/governance-implementation-roadmap-v0.1.md`
- use `docs/03-governance/decentralized-transition-architecture.md` as the target architecture
- start with `Section 14. Immediate Next Steps`

The safest short continuation prompt is:

`Continue the Levela decentralization work from docs/04-operations/dev/governance-implementation-roadmap-v0.1.md, starting with Section 14 Immediate Next Steps.`

## 17. Success Condition

This roadmap is complete when:

- civic status is first-class in schema
- governance rights are server-enforced
- founder office is constitutionally distinct from blanket admin power
- domain stewardship is modeled explicitly
- governance participation exists for citizens, not only admins
- activation and maturity can be tracked procedurally
