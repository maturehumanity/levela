# Development, Test, and Live Lifecycle

Levela is open source, but open contribution is not the same as open deployment. Code, schema, and release artifacts move through explicit gates.

## Environments

| Environment | Purpose | Data policy | Promotion rule |
| --- | --- | --- | --- |
| Development | Local contributor work, forks, and feature branches. | Local fixtures or developer-owned data only. | Pull request with CI and review. |
| Test | Authorized validation of merged changes and APK update behavior. | Seeded synthetic data by default; sanitized production snapshots only after a written export/sanitization procedure exists. Test must not write to Live data. | Maintainer approval after checks pass. |
| Live | Production users, production APK, and public website. | Production Supabase data plus signed/auditable decentralized artifacts. | Explicit promotion from a tested build. |

For now, Levela uses one public web origin (`https://levela.yeremyan.net`) and separate Android update manifests for Test and Live. The app exposes a Live/Test update-channel selector in Settings. Test selection automatically returns to Live after a short window so users do not stay on the Test track by accident.

## Contribution and Deployment Rules

- Anyone may fork the repository and open a pull request.
- Pull requests must pass CI before merge.
- Pull requests from untrusted forks must never deploy automatically.
- Protected branches must require maintainer review before merge.
- CODEOWNERS should require extra review for release, workflow, database, and governance-sensitive files.
- Merged work goes to the Test channel first.
- Production promotion must be explicit and auditable.
- APK binaries are not committed to the repository. The website hosts current APK downloads; GitHub Releases may mirror signed production artifacts.

## Data and Decentralization Model

Supabase remains the operational source of truth while Levela is still early-stage. It provides authentication, row-level security, transactional writes, realtime subscriptions, and the migration history the app already depends on.

That does not make Supabase the final trust root. The decentralized target is:

- **Operational database:** Supabase/Postgres for current app state and permissioned writes.
- **Append-only evidence:** signed events, governance logs, release manifests, hashes, and verifier receipts.
- **Independent verification:** public mirrors can verify signed artifacts and detect unauthorized mutation.
- **Eventual federation:** approved verifier nodes can replicate and challenge public audit data before any future move away from a single primary database.

Do not replace Supabase with a decentralized store until the replacement can provide equivalent identity, permissioning, auditability, migrations, backup/restore, and conflict-resolution semantics. The practical path is to decentralize verification first, then progressively decentralize writes.

## Test Data Choice

Use seeded synthetic data first.

Reasons:

- It is reproducible in CI and local development.
- It avoids leaking private production data.
- It prevents accidental production writes.
- It can model edge cases better than a raw production snapshot.

Sanitized production snapshots may be added later, but only with a documented sanitizer that removes private messages, sensitive profile fields, official identifiers, phone numbers, email addresses, and any personal or financial data not needed for testing.

## Production GitHub Downloads

It is acceptable to publish the production APK through GitHub Releases as a mirror, provided:

- the release is created from a signed/tagged source revision,
- the APK matches the production manifest version,
- checksums are published,
- the official website remains the primary update endpoint,
- no APK is committed directly to the repository.
