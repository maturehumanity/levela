# Remote DB Access (VPS Supabase)

This workspace is configured to apply SQL migrations to the VPS-hosted Supabase stack through SSH.

## Stored access in this environment

- SSH host alias: `soc-yeremyan-net`
- SSH config location: `~/.ssh/config`
- Key path used by that alias: `~/.ssh/soc-yeremyan-net`

## Apply a migration

Run:

```bash
scripts/db-apply-remote-migration.sh supabase/migrations/<migration-file>.sql
```

Example:

```bash
scripts/db-apply-remote-migration.sh supabase/migrations/20260412204000_add_governance_and_study_tables.sql
```

## Optional overrides

You can override defaults per-command:

```bash
REMOTE_DB_HOST=soc-yeremyan-net \
REMOTE_DOCKER_DIR=~/supabase-stack/supabase/docker \
REMOTE_DB_USER=postgres \
REMOTE_DB_NAME=postgres \
scripts/db-apply-remote-migration.sh supabase/migrations/<migration>.sql
```
