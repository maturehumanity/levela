# Levela Mobile MVP – Development Specification

## Status
- Branch: dev
- Scope: MVP
- Platform: React Native (Expo)
- Backend: Node.js + Express
- Database: SQLite (MVP)

## Purpose
This document defines the original intent, scope, and functional requirements
for the Levela Mobile MVP. It serves as the source of truth for what the system
was designed to implement at this stage.

## Core Concept
Levela is a mobile-first civic-tech platform that allows individuals to build
a public Trust & Contribution profile using a structured, evidence-based,
five-pillar evaluation system.

The MVP focuses on:
- Identity
- Endorsements
- Evidence
- Transparency
- Explainable scoring

## The Five Pillars
The system is built around five fixed pillars:

1. Education & Skills  
2. Culture & Ethics  
3. Responsibility & Reliability  
4. Environment & Community  
5. Economy & Contribution  

These pillars are implemented as fixed enums across frontend and backend.

## User Roles

### User
- Register and authenticate
- Create and edit profile
- Endorse other users
- Upload evidence
- Control profile visibility
- View scores and endorsements

### Admin
- View reports
- Moderate endorsements
- Assign verification status

## Scoring Model (MVP)
- Endorsements are given as 1–5 stars per pillar
- Each pillar score ranges from 0–100
- Pillar score = (average stars / 5) × 100
- Overall Levela Score = average of all five pillar scores

### Guardrails
- Users cannot endorse themselves
- One endorsement per rater → ratee → pillar per 30 days
- New users have neutral rating weight
- All endorsements are timestamped

## Core Screens
- Onboarding & authentication
- Home / Activity feed
- User search
- Profile (self and others)
- Endorsement flow
- Evidence management
- Reports & moderation
- Settings

## Evidence
Evidence items:
- Are linked to a single pillar
- Can be links, text, or uploaded files
- Have visibility controls (public / private)

## Technical Constraints
- Mobile-first UX
- Clean, minimal UI
- Explainable logic (no black-box scoring)
- Seeded demo data for development and testing

## Out of Scope (MVP)
- Organizations
- Projects or missions
- Automated verification
- AI moderation
- Governance or voting systems

## Notes
This document reflects the initial design intent and may diverge from
implementation details as the system evolves. Changes should be documented
in subsequent dev notes or revisions.
