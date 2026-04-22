# SSH, Bash, and Cursor / VS Code (Levela)

This note avoids two common mistakes: **pasting editor settings into the terminal**, and **Careercenter keys prompting while you work in Levela**.

## 1. Editor settings are not terminal commands

**Do not** paste JSON like `"terminal.integrated.env.linux": { ... }` into the Bash prompt. Bash will try to run it as shell commands and print errors (that is annoying but it does not corrupt your project).

**Do** put that JSON inside the project file:

`levela-your-growth-score/.vscode/settings.json`

Open that file in the editor, ensure it is valid JSON (commas, matching braces), and save. Cursor / VS Code read it when the folder is open.

## 2. What this repo configures

This workspace’s `.vscode/settings.json` sets environment variables **only for integrated terminals opened in this folder**:

| Variable | Purpose |
|----------|---------|
| `SSH_AUTO_ADD_LEVELA=1` | Allows `~/.bashrc` to run `ssh-add` for **`~/.ssh/soc-yeremyan-net`** when that identity is not already in `ssh-agent`. You may be prompted for the **Levela VPS** passphrase once per agent session. |
| `SSH_AUTO_ADD_CAREERCENTER` empty | Disables any Careercenter auto-load from a **global** Cursor/VS Code user setting, so Levela terminals should not opt into Careercenter. |

## 3. How `~/.bashrc` behaves on your machine

- **`~/.ssh/ensure-ssh-agent.sh`** (sourced early): keeps a shared agent on `~/.ssh/agent.sock`.
- **Careercenter**: there is **no** automatic `ssh-add` for `careercenter.key` in `~/.bashrc`. When you need Careercenter SSH, run manually in any terminal:

  ```bash
  ssh-add ~/.ssh/careercenter.key
  ```

- **Levela VPS**: `ssh-add` for `soc-yeremyan-net` runs **only** when `SSH_AUTO_ADD_LEVELA=1` (this repo’s workspace settings).

## 4. If Careercenter still prompts in a Levela terminal

1. In that terminal run:

   ```bash
   env | grep SSH_AUTO
   ```

   You want `SSH_AUTO_ADD_LEVELA=1` and **no** `SSH_AUTO_ADD_CAREERCENTER=1`.

2. In **Cursor / VS Code → Settings → search “terminal integrated env”** open **User** `settings.json` (global). Remove any `SSH_AUTO_ADD_CAREERCENTER` or stray `ssh-add` automation from **terminal.integrated.env.linux** unless you really want it for **every** workspace.

3. Check **`~/.ssh/config`**: `AddKeysToAgent yes` on `Host srv` only affects behavior **when something runs `ssh srv`**. It should not run by itself when you open a terminal. If some extension or script SSHs to `srv` on startup, you would still see a passphrase prompt for `careercenter.key` until that flow is disabled or the key is already in the agent.

4. Close the terminal tab and open a **new** one after changing settings (old tabs keep old environment).

## 5. Quick checks

```bash
# Agent socket (stable setup)
echo "$SSH_AUTH_SOCK"

# Keys currently loaded
ssh-add -l

# Levela VPS non-interactive test (after ssh-add)
ssh -o BatchMode=yes soc-yeremyan-net 'echo ok'
```

See also `REMOTE_DB_ACCESS.md` for applying SQL over SSH.
