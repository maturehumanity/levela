# Remote DB Access (VPS Supabase)

This workspace is configured to apply SQL migrations to the VPS-hosted Supabase stack through SSH.

## Stored access in this environment

- SSH host alias: `soc-yeremyan-net`
- SSH config location: `~/.ssh/config`
- Key path used by that alias: `~/.ssh/soc-yeremyan-net`

That key is **passphrase-protected**. Headless tools (including Cursor agents) only succeed if the unlocked public key is already present in `ssh-agent` for this session.

Before running remote migration scripts from an agent or CI shell:

1. In a normal **interactive** terminal on the same machine (or any terminal that shares the same `SSH_AUTH_SOCK`), run:

   ```bash
   ssh-add ~/.ssh/soc-yeremyan-net
   ```

2. Confirm non-interactive SSH works:

   ```bash
   ssh -o BatchMode=yes soc-yeremyan-net 'echo ok'
   ```

If Codex could SSH but a later agent cannot, compare `ssh-add -l` with `ssh-keygen -lf ~/.ssh/soc-yeremyan-net`: the VPS key fingerprint must appear in the agent list.

### Stable ssh-agent on this dev machine (WSL / Linux)

This environment uses a **fixed agent socket** at `~/.ssh/agent.sock` so every Bash—including Cursor’s non-interactive shells—shares one `ssh-agent`:

- `~/.ssh/ensure-ssh-agent.sh` starts or reuses that agent.
- `~/.bashrc` sources it **before** the usual “non-interactive return”, so agents inherit `SSH_AUTH_SOCK`.
- `~/.profile` sets `BASH_ENV=~/.ssh/bash_noninteractive_env.sh` so plain `bash -c` still loads the same agent.

After a **reboot** (or if you kill `ssh-agent`), open any interactive terminal once; it will prompt to `ssh-add` the Levela VPS key if missing. You should **not** need to re-add keys after only restarting Cursor.

If a Cursor feature still shows the wrong socket, set in Cursor **Settings → JSON** (optional):

```json
"terminal.integrated.env.linux": {
  "SSH_AUTH_SOCK": "/home/<you>/.ssh/agent.sock"
}
```

Use your real home directory path (the same directory as `~/.ssh/agent.sock`).

### Workspace-scoped `ssh-add` (Levela)

`~/.bashrc` only auto-runs `ssh-add` for **`soc-yeremyan-net`** when the workspace sets **`SSH_AUTO_ADD_LEVELA=1`** (this repo’s `.vscode/settings.json`). Careercenter is **not** wired in `~/.bashrc`; use `ssh-add ~/.ssh/careercenter.key` manually when you need that client.

Step-by-step (including “do not paste JSON into the terminal”): **`docs/04-operations/dev/SSH_SHELL_AND_CURSOR.md`**.

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
REMOTE_DB_HOST=soc-yeremyan-net-agent \
REMOTE_DOCKER_DIR=/home/ubuntu/supabase-stack/supabase/docker \
REMOTE_DB_USER=postgres \
REMOTE_DB_NAME=postgres \
scripts/db-apply-remote-migration.sh supabase/migrations/<migration>.sql
```
