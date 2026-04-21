# Levela Decentralized Transition Architecture

Levela can become much harder to capture or manipulate, but it is important to be precise: no digital system can honestly guarantee that manipulation is impossible for every individual, group, or country in every circumstance. What we can do is remove single points of control, make every sensitive action publicly auditable, require distributed approval for governance changes, and let citizens verify state instead of trusting one operator.

This document translates that goal into a transition plan for the current Levela application.

## Current Trust Model

Today the application is operationally centralized around Supabase plus privileged platform roles:

- Auth and session control are rooted in Supabase client auth at `src/integrations/supabase/client.ts` and `src/contexts/AuthContext.tsx`.
- Governance state is stored in centralized tables such as `monetary_policy_profiles`, `monetary_policy_approvals`, and `monetary_policy_audit_events` in `supabase/migrations/20260412204000_add_governance_and_study_tables.sql`.
- High-privilege actions are controlled by `founder`, `admin`, or `system` roles in `src/lib/access-control.ts`.
- Privileged edge functions like `supabase/functions/admin-create-user/index.ts` and `supabase/functions/admin-impersonate-user/index.ts` can create or assume accounts through service-role authority.

That means the current root of trust is still one backend operator and one permission hierarchy. This is efficient for early development, but it does not satisfy the long-term civic requirement that no one actor should be able to steer the system alone.

## Design Goals

The target system should enforce these properties:

1. No single backend operator can change governance state unilaterally.
2. No secret admin path can create, impersonate, or silently alter citizen authority.
3. Every governance decision has a tamper-evident public trail.
4. Citizens can verify app state from multiple independent sources.
5. Identity is unique and legitimate without exposing raw personal data to everyone.
6. Emergency powers exist, but only behind transparent, threshold-based controls.

## Target Architecture

Use a layered model rather than trying to put the whole app on-chain.

### 1. Identity Layer

Replace platform-owned identity authority with citizen-controlled cryptographic identity:

- Each citizen gets a wallet-based identity and signing key pair.
- The app links that key to a decentralized identifier and a Levela citizen profile.
- Verification status becomes a set of verifiable credentials, not a mutable admin flag.
- Sensitive identity evidence stays off-chain in encrypted storage, while proofs and revocation registries are public and auditable.

Recommended rule: never place passport, SSN, or raw birth data on-chain. Only anchor hashes, attestations, revocation proofs, and consented claims.

### 2. Governance Layer

Move governance decisions to transparent, threshold-controlled state transitions:

- Proposals are content-addressed documents.
- Votes are signed by verified citizens.
- Final proposal outcomes are committed to a public blockchain or other independently replicated consensus layer.
- Governance rules, quorum, approval thresholds, and upgrade paths are themselves versioned and publicly auditable.
- Emergency actions require threshold signatures from independent constitutional guardians rather than a founder or admin role.

### 3. Data Layer

Split data by what must be globally consensus-backed and what can remain replicated application data:

- On-chain or consensus-anchored: proposal hashes, vote commitments, constitutional rule versions, treasury actions, role/credential revocations, audit roots.
- Off-chain but replicated and verifiable: profiles, discussions, study progress, content bodies, moderation evidence, search indexes.
- Large public content should be stored in content-addressed storage so many parties can mirror it.
- Application snapshots should be regularly hashed and anchored so any citizen can detect tampering.

### 4. Execution Layer

Replace privileged server execution with constrained, verifiable automation:

- No function should be able to create power outside the governance rules.
- Sensitive actions require signed user intent and, when relevant, multi-party approval proofs.
- Server operators become relay providers, indexers, or storage hosts rather than sovereign administrators.
- Clients must verify signed responses and audit proofs instead of trusting raw backend payloads.

### 5. Client Layer

The app should become verification-first:

- The client verifies proposal state, vote receipts, credential signatures, and content hashes.
- The client can read from multiple gateways or mirrors and compare results.
- Users can export their identity, credentials, votes, and content pointers without platform permission.

## What Must Change In This Codebase

### Remove Single-Operator Powers

These current patterns should be treated as temporary bootstrap mechanisms and eventually removed:

- `founder` and `admin` having blanket power in `src/lib/access-control.ts`
- direct `settings.manage` and `role.assign` control over governance tables
- service-role account creation in `supabase/functions/admin-create-user/index.ts`
- user impersonation in `supabase/functions/admin-impersonate-user/index.ts`

In the decentralized model:

- account creation becomes citizen self-registration plus credential issuance
- role assignment becomes credential-driven and proposal-driven
- impersonation is forbidden
- emergency intervention is threshold-gated, logged, appealable, and time-limited

### Reframe Supabase

Supabase can still be useful, but no longer as the sovereign authority.

Supabase should become:

- a replicated app data store
- an indexing layer
- a notification layer
- an optional relay for signed transactions

Supabase should not remain:

- the final source of truth for governance legitimacy
- the only keeper of identity truth
- the only place where authorization decisions are made

## Fraud Resistance Model

Fraud prevention here requires more than decentralization. It needs a full anti-capture design.

### Sybil Resistance

To stop one person from pretending to be many citizens:

- require a unique-person credential before voting weight activates
- separate social participation from governance participation
- use multiple independent attestors for high-trust citizenship
- support challenge and revocation workflows with evidence trails

### Capture Resistance

To stop a coordinated group from taking over:

- require slow governance changes with notice periods
- separate constitutional changes from ordinary policy changes
- use quorum rules based on verified active citizens, not raw account count
- require geographically and institutionally diverse guardians for emergency controls

### Country Resistance

To reduce nation-state control:

- operate validators, gateways, and storage mirrors across many jurisdictions
- make the client open source and reproducibly buildable
- allow peer-to-peer or mirror-based content retrieval
- avoid dependence on one cloud, one DNS provider, one app store, or one identity issuer

### Transparency

To make abuse visible:

- store append-only governance events
- hash and anchor audit logs regularly
- publish policy diffs, vote tallies, and execution receipts
- give every citizen a way to verify that their vote and credential status were included correctly

## Recommended Transition Plan

### Phase 0: Constitutional Foundation

Before changing infrastructure, define the civic rules:

- who qualifies as a citizen
- how citizenship is verified
- which actions require ordinary majority, supermajority, or guardian threshold approval
- how emergencies, disputes, appeals, and revocations work
- how the system upgrades without reintroducing central control

### Phase 1: Cryptographic Identity

Introduce wallet-linked citizen identities alongside current Supabase auth:

- add citizen public keys to profiles
- require signed intents for sensitive actions
- model verification as attestations rather than admin-only columns
- begin removing flows that rely on operator impersonation

### Phase 2: Signed Governance Events

Keep the app largely as-is, but stop trusting mutable rows alone:

- proposals, approvals, and votes become signed events
- every event gets a content hash
- audit roots are anchored externally on a public chain
- governance UIs display proof status, not just database status

### Phase 3: Threshold Governance

Replace founder/admin overrides:

- retire unilateral `founder` powers
- require multisig or distributed guardian approval for emergency actions
- require proposal execution proofs before policy state changes
- restrict database writes so they can only mirror already-approved state transitions

### Phase 4: Replicated Public State

Make the system independently observable:

- mirror content and governance data to content-addressed storage
- publish snapshot roots
- support multiple read gateways
- let third parties run public verifiers and indexers

### Phase 5: Minimize Trusted Backend

Reduce the backend to an optional convenience layer:

- client verifies credentials, votes, and proposal outcomes directly
- backend relays become replaceable
- governance legitimacy survives if the original Levela-hosted infrastructure disappears

## Concrete Repo Backlog

The most useful next engineering steps in this repository are:

1. Add a signed-action model for governance events instead of direct privileged writes to governance tables.
2. Replace admin impersonation with delegated support workflows that never mint another user's session.
3. Add public-key fields, signature verification utilities, and signed-intent enforcement for governance actions.
4. Separate bootstrap staff operations from constitutional citizen governance in both permissions and UI.
5. Define append-only event tables for proposals, votes, credential attestations, revocations, and execution receipts.
6. Anchor event-batch hashes to an external consensus network.
7. Refactor authorization so roles are derived from verifiable credentials and ratified state, not only mutable profile flags.

## Non-Negotiable Safety Rules

- Never store raw government ID material on-chain.
- Never allow silent admin impersonation in a civic system.
- Never let one service-role key remain the final authority over citizen legitimacy.
- Never treat decentralization as only an infrastructure problem; it is also a constitutional, identity, and audit problem.

## Practical Recommendation

Do not attempt a one-step rewrite into a fully on-chain app. That would likely make the system less safe, less private, and less usable.

Instead, keep the current product as the user-facing shell, but transition the trust model in this order:

1. identity and signatures
2. signed governance events
3. threshold execution
4. replicated public state
5. backend minimization

That path gives Levela a realistic route from startup-style administration to citizen-verifiable governance without pretending that absolute invulnerability is achievable.
