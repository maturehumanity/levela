# VPS SSH for Cursor / headless scripts (Levela)

Human access continues to use **`soc-yeremyan-net`** with the passphrase-protected key **`~/.ssh/soc-yeremyan-net`**.

For **non-interactive** use (Cursor agents, `scripts/db/apply-remote-migration.sh` without `ssh-agent` identities), this machine uses a **separate, passphrase-less** key pair:

| File | Purpose |
|------|---------|
| `~/.ssh/levela_cursor_agent_ed25519` | Private key (local only; never commit) |
| `~/.ssh/levela_cursor_agent_ed25519.pub` | Public half — install **once** on the VPS |

SSH config **`Host soc-yeremyan-net-agent`** points at the same VPS as `soc-yeremyan-net` but uses that automation key.

**Security:** Treat this key like deploy access to that VPS user. Prefer restricting the `authorized_keys` line (e.g. `restrict` / `command=`) if your VPS policy allows; this doc keeps the standard unrestricted line for simplicity.

## One-time install on the VPS

From **this** machine, after your **human** key works to the same host (passphrase entered or agent loaded), either:

**A — helper script (runs `ssh-copy-id`):**

```bash
bash scripts/db/vps-install-agent-ssh-key.sh
```

**B — `ssh-copy-id` directly:**

```bash
ssh-copy-id -i "$HOME/.ssh/levela_cursor_agent_ed25519.pub" -o IdentitiesOnly=yes soc-yeremyan-net
```

If `ssh-copy-id` reports the key is already present but **`ssh soc-yeremyan-net-agent` still fails**, the line may be missing on the server; append explicitly:

```bash
PUB=$(cat "$HOME/.ssh/levela_cursor_agent_ed25519.pub")
printf '%s\n' "$PUB" | ssh -o IdentitiesOnly=yes soc-yeremyan-net "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -Fxq \"\$PUB\" ~/.ssh/authorized_keys || cat >> ~/.ssh/authorized_keys"
```

That appends the agent public key to **`ubuntu`**’s `~/.ssh/authorized_keys` on **130.61.32.187**.

**Manual:** print the public key and paste one line into the VPS `authorized_keys`:

```bash
cat "$HOME/.ssh/levela_cursor_agent_ed25519.pub"
```

## Verify

```bash
ssh -o BatchMode=yes soc-yeremyan-net-agent 'echo ok'
```

Remote DB scripts default to **`soc-yeremyan-net-agent`** when the private key file exists, unless **`REMOTE_DB_HOST`** is set in the environment or **`.env.local`**.

## Override

In **`.env.local`** set `REMOTE_DB_HOST=soc-yeremyan-net` to force the human key (and then rely on `ssh-agent` as before).
