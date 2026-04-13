# Content Collaboration Model

Levela content is governed by three questions:

1. What is this content? This is the content category and content type.
2. How risky is it if wrong? This determines the moderation lane.
3. Who is qualified to contribute or approve it? This is resolved from user role plus certified profession.

## Moderation Lanes

| Lane | Meaning | Publication behavior |
| --- | --- | --- |
| `unmoderated` | Low-risk expression or personal-use content. | Can publish immediately after automated classification and safety checks. |
| `moderated` | Content with institutional, professional, legal, academic, policy, or governance weight. | Requires review before it becomes canonical or is presented as authoritative. |

Unmoderated does not mean unaccountable. It means pre-publication expert review is not required by default.

## Content Categories

| Category | Use for | Default lane | Default contributor |
| --- | --- | --- | --- |
| `intercommunication` | Chats, direct messages, ordinary comments, lightweight social posts. | `unmoderated` | Any member with basic create permission. |
| `leisure_reading` | Books or notes read for enjoyment without formal learning claims. | `unmoderated` | Any member with basic create permission. |
| `community_knowledge` | Informal explainers and public-interest knowledge that is not a certified course. | `unmoderated` | Verified members and above. |
| `academic_material` | Study books, courses, learning modules, exams, formal educational material. | `moderated` | Certified education, governance, law, or domain-specific professionals. |
| `professional_material` | Professional standards, practice guides, certification materials, discipline references. | `moderated` | Certified professionals in the matching profession. |
| `legal_content` | Constitutions, statutes, contracts, compliance guidance, rights frameworks. | `moderated` | Certified law or governance professionals, plus staff reviewers. |
| `policy` | Platform policy, monetary policy, moderation policy, governance rules. | `moderated` | Staff roles only unless admins grant explicit overrides. |
| `system_operations` | Developer runbooks, release procedures, remote database access, infrastructure notes. | `moderated` | Staff roles only unless admins grant explicit overrides. |

## Professions

Professions are not job titles. They are contribution domains used for authorization. A user can have more than one profession, and each profession can have a verification status.

Core profession domains:

| Profession | Typical scope |
| --- | --- |
| `education` | Academic materials, curricula, study design, assessments. |
| `law` | Legal references, rights frameworks, compliance-sensitive content. |
| `governance` | Policy, public administration, civic systems, institutional design. |
| `medicine` | Health and medical education or safety-sensitive wellness content. |
| `finance` | Monetary, accounting, financial-risk, and economic contribution material. |
| `engineering` | Engineering standards, safety systems, technical professional material. |
| `technology` | Software, AI, data, security, and operational documentation. |
| `environment` | Environmental stewardship, sustainability, climate, and ecological policy. |
| `economics` | Economic systems, labor, public value, and market-policy materials. |
| `arts_culture` | Cultural, creative, humanities, and public education content. |

## Roles

| Role | Meaning in content collaboration |
| --- | --- |
| `member` | Can create ordinary unmoderated content. |
| `verified_member` | Can create ordinary content with stronger identity trust. |
| `certified` | Has at least one approved profession and can contribute to matching moderated categories. |
| `moderator` | Can moderate queues and enforce rules, but should defer expert approval when category rules require profession match. |
| `market_manager` | Can manage marketplace content and operational surfaces delegated to market operations. |
| `admin` | Can manage users, permissions, roles, and content workflows. |
| `founder` | Full founding authority and emergency governance authority. |
| `system` | Automation and internal services. |

## Automatic Categorization Rules

The application should classify new content using explicit content type first, source context second, and text/tag signals third.

| Signal | Category | Lane |
| --- | --- | --- |
| Direct chat or messaging UI | `intercommunication` | `unmoderated` |
| Feed comment or ordinary social post | `intercommunication` | `unmoderated` |
| Book, novel, story, poem, leisure note | `leisure_reading` | `unmoderated` |
| Study, course, lesson, workbook, exam, curriculum | `academic_material` | `moderated` |
| Professional guide, standard, certification, clinical, engineering, accounting, security, or practice material | `professional_material` | `moderated` |
| Constitution, law, contract, statute, compliance, rights, regulation | `legal_content` | `moderated` |
| Platform rule, governance proposal, monetary policy, moderation policy, operating policy | `policy` | `moderated` |
| Release, deployment, database, security, runbook, admin procedure | `system_operations` | `moderated` |

When rules conflict, choose the stricter lane. For example, a book used as a certification textbook is `academic_material`, not `leisure_reading`.

## Contribution Authorization

A user can contribute to a content item when all of the following are true:

1. Their role has the required app permission for the action.
2. The content lane allows their role.
3. If the category requires profession matching, the user has an active approved profession in one of the allowed domains.
4. Moderated content remains unpublished until reviewed by an eligible reviewer.

## Recommended Review States

| State | Meaning |
| --- | --- |
| `draft` | Author or importer is preparing content. |
| `proposed` | Submitted for review. |
| `in_review` | A moderator or eligible certified reviewer is actively reviewing. |
| `changes_requested` | The reviewer found issues to fix. |
| `approved` | Canonical or publishable. |
| `rejected` | Not accepted into canonical content. |
| `archived` | Superseded but retained for traceability. |

## Collaboration Norms

- Treat folders as governance boundaries, not decoration.
- Keep metadata close to content so humans and automation can agree.
- Prefer narrow professional scopes over broad authority.
- Preserve history for policy and legal materials.
- Do not let ordinary chat accidentally become policy, academic instruction, or legal guidance.
- Do not let professional content bypass review because it arrived through an informal interface.
