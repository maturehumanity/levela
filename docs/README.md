# Levela Documentation Filing System

This directory is organized around how content is governed inside the application. Every file should belong to one moderation lane, one content category, and, when relevant, one professional domain.

## Top-Level Folders

| Folder | Purpose | Default lane |
| --- | --- | --- |
| `00-intake/` | Drafts, templates, import manifests, and content awaiting classification. | Pending |
| `01-unmoderated/` | Low-risk user expression and personal reading content that can publish immediately after automated safety checks. | Unmoderated |
| `02-moderated/` | Academic, professional, legal, policy, and governance content that needs qualified review before publication. | Moderated |
| `03-governance/` | Rules that explain content categories, professions, certification, and contribution authority. | Moderated |
| `04-operations/` | Developer, release, deployment, and operational runbooks. | Moderated |

## Required Filing Metadata

Every durable content file should include or be accompanied by this metadata:

```yaml
content_id: kebab-case-stable-id
title: Human readable title
content_category: academic_material | intercommunication | leisure_reading | legal_content | policy | professional_material | system_operations
moderation_lane: unmoderated | moderated
content_type: chat_message | comment | book | study_book | course | policy_document | legal_reference | runbook
professional_domain: none | law | education | medicine | finance | engineering | governance | technology | environment | economics
contribution_policy: open | verified_only | certified_professionals | staff_only
owner_role: member | verified_member | certified | moderator | admin | founder | system
review_status: draft | proposed | approved | archived
```

## Filing Rule Of Thumb

If content can materially influence someone's legal rights, professional learning, public policy, money, health, safety, or platform governance, file it under `02-moderated/` and require qualified review. If it is ordinary conversation or leisure reading with no institutional claim, file it under `01-unmoderated/`.

## Current Active Content

- Constitutional study materials live under `02-moderated/academic-materials/constitutional-studies/universal-constitution/`.
- Monetary policy and AI agent specifications live under `02-moderated/policies/monetary/`.
- Developer and release operations live under `04-operations/dev/`.

## Collaboration Flow

1. New content starts in `00-intake/` or enters through the app.
2. The automatic classifier assigns category, lane, content type, and professional domain.
3. Unmoderated content can publish immediately unless safety checks flag it.
4. Moderated content enters review and can only be approved by staff or certified users whose profession matches the category rule.
5. Approved content moves into the canonical folder and receives stable metadata.
6. Archived or superseded content stays discoverable with `review_status: archived` rather than being deleted silently.
