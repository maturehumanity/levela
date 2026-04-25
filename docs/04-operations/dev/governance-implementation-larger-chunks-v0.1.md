---
content_id: governance-implementation-larger-chunks-v0-1
title: Governance Implementation — Larger Chunks v0.1
content_category: system_operations
moderation_lane: moderated
content_type: runbook
professional_domain: technology
contribution_policy: staff_only
owner_role: founder
review_status: draft
---

# Governance Implementation — Larger Chunks v0.1

This document groups [`governance-implementation-roadmap-v0.1.md`](./governance-implementation-roadmap-v0.1.md) into **fewer, reviewable verticals**. Each chunk lists a primary goal, typical surfaces, dependencies, and a short **shipped vs gap** note. Order follows the roadmap’s migration intent (§8–§9) while allowing parallel work where dependencies are weak.

## Coordination with other workstreams

Governance chunks can proceed in parallel with **Market** and **Messaging** page work as long as agents **avoid drive-by edits** to market/messaging routes and components unless the task explicitly requires them. Prefer `src/lib/governance-*`, governance and admin settings surfaces, schema/migrations, and ops docs; coordinate on shared files (`App.tsx`, layout shells) with small, reviewable diffs. See also [`AGENTS.md`](./AGENTS.md) §3 (concurrent page ownership).

## Chunk overview

| Chunk | Theme | Roadmap anchors | Depends on |
|------|--------|-----------------|------------|
| **1** | Civic & eligibility substrate | §5.3–5.5, §8 Phase 1, §11 tests | Auth + profiles |
| **2** | Identity verification program | §5.6, §8 Phase 2, §7.2 | Chunk 1 (civic fields help reason about outcomes) |
| **3** | Sanctions & governance blocks | §5.7, §9 item 3 | Chunks 1–2 for coherent “who is blocked and why” |
| **4** | Constitutional office & domain roles | §5.10, §8 Phase 3, §6 founder rule | Chunk 1; overlaps Chunk 3 for enforcement |
| **5** | Democratic participation (proposals, votes, lifecycle) | §5.8–5.9, §8 Phase 4, `governance_action_intents` | Chunks 1–3 minimum; 4 for reserved domains |
| **6** | Activation & maturity | §5.11, §8 Phase 5 | Chunks 1–2; 5 optional for governance-linked activation |
| **7** | Permissions refactor & server-side gates | §6, §9 item 7, §10 | Exercises all prior chunks in policies |
| **8** | Citizen vs steward UX & navigation | §7 (especially §7.4) | Routes exist; tighten as Chunks 5–7 land |

---

## Chunk 1 — Civic & eligibility substrate

**Goal:** Treat civic status and governance eligibility as first-class, auditable state distinct from product role.

**Surfaces:** `profiles` civic columns; `governance_eligibility_snapshots`; client evaluation in `src/lib/governance-eligibility.ts` and snapshots; `Governance.tsx` / admin tools that persist snapshots.

**Acceptance:** Eligibility changes are explainable from stored inputs; snapshots can be reconciled with live policy; Vitest covers scoring and edge cases.

**Shipped vs gap:** Migrations and much of the client path exist; remaining work is mostly **consistency, RLS review, and any missing snapshot call sites**—not greenfield schema.

---

## Chunk 2 — Identity verification program

**Goal:** Replace “single boolean verified” UX with a structured case lifecycle and reviewer hooks.

**Surfaces:** `identity_verification_cases` (and related migrations); future `Identity Verification` flow page (§7.2); RLS tied to reviewer roles.

**Acceptance:** State transitions are append-only or audited; profile projection matches case outcome; no sensitive payload leakage via client.

**Shipped vs gap:** Backend tables and some RLS exist; **full UI flow and operational runbooks** remain the main gap.

---

## Chunk 3 — Sanctions & governance blocks

**Goal:** Persist sanctions and governance blocks so participation and treasury actions can be denied consistently.

**Surfaces:** Sanctions models, `Governance.tsx` / admin surfaces, RPC or SQL used for “is this user blocked for scope X”.

**Acceptance:** Blocked users cannot complete gated actions even with a crafted client; appeals status is visible where policy requires it.

**Shipped vs gap:** Partial UI and libs exist; **server enforcement** (Chunk 7) is the long-term gate.

---

## Chunk 4 — Constitutional office & domain roles

**Goal:** Separate “founder app role” from constitutional office and domain stewardship (roadmap §6.3).

**Surfaces:** New office/domain tables (Phase 3); permission resolution; admin/steward consoles (§7.3).

**Acceptance:** Founder powers are explainable and scoped; emergency bootstrap paths are documented.

**Shipped vs gap:** **Largely not started** in product schema; policy docs ahead of code.

---

## Chunk 5 — Democratic participation

**Goal:** Proposal creation, voting, quorum, and ratification with `governance_action_intents` integrated into the lifecycle.

**Surfaces:** Proposal/vote tables; citizen `Governance` hub; any verifier/federation hooks already in motion.

**Acceptance:** One vote per eligible identity; reserved proposal types require the right domain roles; audit trail for execution.

**Shipped vs gap:** Rich **client** governance hub exists; **normalized vote/proposal tables and full server lifecycle** still align with Phase 4.

---

## Chunk 6 — Activation & maturity

**Goal:** Country/world activation evidence, thresholds, and maturity snapshots (roadmap §5.11, Phase 5).

**Surfaces:** Activation review tables; steward “Activation review” console; public or citizen-facing activation status page.

**Acceptance:** Declarations are reviewable; evidence is scoped; reversals are audited.

**Shipped vs gap:** **Mostly schema and policy**; implementation follows Chunks 1–2 and optionally 5.

---

## Chunk 7 — Permissions & server-side gates

**Goal:** Introduce governance-specific permissions (§6.2), refactor broad admin keys, and move critical checks to RLS / SQL / signed flows (§10).

**Surfaces:** `src/lib/access-control.ts`; role seed migrations; Edge functions or RPC; RLS on governance tables.

**Acceptance:** No critical governance action relies on client-only checks; matrix in admin reflects new tokens.

**Shipped vs gap:** **Foundational RBAC exists; governance tokens and enforcement depth are the gap.**

---

## Chunk 8 — Citizen vs steward UX & navigation

**Goal:** Split **citizen-facing** governance from **steward/admin** operations (§7.4); add discoverability from Settings, Home, and terms-adjacent links as appropriate.

**Surfaces:** `src/pages/Settings.tsx`, `src/App.tsx`, `Governance.tsx`, `GovernanceAdmin.tsx`, i18n keys, feature registry if catalog entries need distinct pages.

**Acceptance:** A normal member can reach `/governance` without admin rights; admins still use `/settings/admin/governance` for policy parameters.

**Shipped vs gap:** `/governance` route exists; **this chunk incrementally adds navigation and copy**, then deeper page splits as Chunk 5–7 mature.

---

## How to use this with PRs

- Prefer **one chunk per epic branch** when touching schema plus UI, or **slice vertically inside a chunk** (e.g. Chunk 8: Settings link first, then Home card, then route guards).
- Keep federation/narrative rollout percentages aligned with **substantive** milestones only (see verifier federation rollout plan §9).
