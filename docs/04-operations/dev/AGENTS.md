# AGENTS Notes

This file stores project-specific notes for future AI agent work.

## 1. Front Card Layout Preservation

- Treat the user-approved `/settings/profile` World Citizen front card layout as a fixed baseline unless the user explicitly asks to restructure it.
- Do not move existing front-card elements between layers, parent groups, or rows while implementing a small feature.
- For category-related work, only change the category-related element itself and the minimum supporting storage/admin wiring required.
- Before changing anything on the front card, inspect the current JSX and preserve:
  - parent-child relationships used by Build mode
  - existing `data-build-key` targets
  - existing spacing/alignment of non-category elements
- If a requested feature could affect layout structure, stop and isolate the change behind the smallest possible insertion point instead of refactoring the card.
- After any front-card change, verify that:
  - `ID Number`, `Given Name`, `Surname`, `Place of Birth`, `Date of Birth`, `Sex`, `Card Expires`, `Member Since`, and footer arrows remain in their existing visual structure
  - no duplicate or hidden replacement build targets were introduced
  - Build mode still maps the same visible element to the same intended layer

## 2. Repository File Hygiene

- Do not create new top-level or unrelated files in the repository unless they are clearly necessary for the requested task.
- Do not create stray tool/agent folders or files such as `.codex` inside the project unless there is a clear, user-requested purpose for them.
- Before creating any new file, prefer:
  - reusing an existing project file
  - placing notes/docs in `docs/04-operations/dev/` instead of the repo root
  - keeping temporary or tool-specific artifacts out of the project tree whenever possible
- If a new file is genuinely needed, choose the narrowest, most appropriate location and keep its purpose directly tied to the user’s request.

## 3. Persistent User Directives

- Do not ask the user to do work the agent can do itself (run commands, read or edit repo files, search the tree, run tests, inspect local config under the workspace). Only ask when something is genuinely impossible from here (for example passphrase entry on their TTY, secrets only they hold, or actions inside an account or UI only they control)—and then say briefly why.
- When the user gives recursive or standing instructions using phrases such as `Always`, `Never`, `make sure`, `don't`, `keep`, `preserve`, or similar strong directive language, treat them as persistent project rules, not one-off comments.
- Capture those instructions in context and continue following them across later requests unless the user explicitly changes or cancels them.
- Before making a change, check whether it conflicts with any previously stated standing instruction from the user.
- If a new request appears to conflict with an older standing instruction, pause and resolve that conflict narrowly instead of silently overriding the older rule.
- Especially preserve standing instructions about:
  - layout stability
  - keeping specific screens or components as the baseline
  - avoiding unrelated files or side effects
  - limiting scope to the exact requested area
- Never make unrequested changes. If a requested feature needs adjacent adjustments, keep them minimal and directly necessary, and say so clearly.
- Never use code-like or translation-key-like text on user-facing screens. Replace it with short, human-friendly labels that clearly describe the element.
- Never place one visible element on top of another unless overlap is part of the element's intended design or the user explicitly asks for it.
- Make sure all user-visible assets and editable elements on every page are explicitly registered in Build mode and Layers, labeled in user-friendly language, and nested in the correct parent order so they can be selected and edited reliably.
- In Build mode, clicking a visible asset should select it without triggering its normal app interaction first, and the current selection should be shown in both the Build panel and the Layers panel.
- When an element is selected in Build mode, make sure the Layers tree auto-expands the relevant parent chain and visibly highlights and scrolls to that selected item.
- When tightening Build mode / Layers coverage on a page, audit earlier existing elements on that same page too, not just newly added elements, so older text/value nodes do not get left behind as group-only targets.
- Do not wait for the user to name missed sub-elements one by one. When a composite field is touched, audit and register its obvious inner parts in the same pass.
- Proactively enforce all standing instructions and notes in this file on future work. Do not wait for the user to repeat them when they clearly apply.
- When the user asks to `update the application`, carry the update through to the actual distributable app artifact and website download path when the project supports it, not just the source code.
- Do not commit or push APK binaries to GitHub for this project. APKs should exist only as local build artifacts on this machine and as deployed download files on the VPS.
- For Study/Constitution UI changes, preserve all existing user-visible labels/structure unless the user explicitly asks to modify that exact element. Do not remove, rename, or restyle article/sub-article labels when the request is about behavior only (for example open/close interactions).
- When the user asks to update/publish the application for testing, always perform a real release bump first (new `APP_VERSION`, `ANDROID_VERSION_CODE`, and `APP_RELEASE_ID`) before running the update/deploy flow, so installed clients can detect and prompt for the new update.

## 4. Remote Environment

- Production for `levela.yeremyan.net` is not served by Lovable. Treat it as a VPS-managed deployment.
- Current known VPS entrypoint:
  - SSH host alias: `soc-yeremyan-net`
  - Host: `130.61.32.187`
  - Port: `26747`
  - User: `ubuntu`
  - Identity file: `~/.ssh/soc-yeremyan-net`
- **Headless / Cursor agents / remote DB scripts** use a separate host alias **`soc-yeremyan-net-agent`** with **`~/.ssh/levela_cursor_agent_ed25519`** (passphrase-less; public key must be in `ubuntu`’s `authorized_keys` on the VPS). See `docs/04-operations/dev/VPS_CURSOR_AGENT_SSH.md`. Prefer **`REMOTE_DB_HOST=soc-yeremyan-net-agent`** in `.env.local` for migrations from agents.
- The human key (`soc-yeremyan-net`) is passphrase-protected; **non-interactive** SSH to that alias still requires **`ssh-agent`**. Dev machines can use the **stable agent socket** in `docs/04-operations/dev/REMOTE_DB_ACCESS.md` for interactive workflows.
- Existing history confirms the VPS also hosts a Supabase stack at `~/supabase-stack/supabase/docker`.
- Live web traffic for `levela.yeremyan.net` is served by the Docker container `caddy-supabase` (`caddy:2.9.1-alpine`).
- The container mounts the actual host web root from `/www/wwwroot/levela` into the container as `/srv/levela` read-only.
- The Caddyfile source on the VPS is `/home/ubuntu/supabase-stack/caddy/Caddyfile`.
- Before saying the application is updated, verify the live site and live APK on `https://levela.yeremyan.net`, not just local build output or GitHub.
- When syncing production, update both:
  - the live web assets for `levela.yeremyan.net`
  - the live Android APK served from the currently linked download path on the website
- Update the host path `/www/wwwroot/levela` directly. Do not try to write into the container mount path `/srv/levela` because it is mounted read-only inside the Caddy container.
- Keep `.user.ini` in `/www/wwwroot/levela` untouched during deploys.
- The legacy path `/downloads/levela-debug.apk` may remain edge-cached by Cloudflare after a deploy; prefer a versioned APK filename in the website bundle for immediate fresh downloads.

## 5. Application Versioning

- The app release source of truth lives in `src/lib/app-release.ts`.
- Keep these three values aligned for every release:
  - `APP_VERSION`
  - `ANDROID_VERSION_CODE`
  - `APP_RELEASE_ID`
- `android/app/build.gradle` reads its Android `versionName` and `versionCode` directly from `src/lib/app-release.ts`.
- The mobile app update prompt reads the live script manifest at `/updates/android.js` on `https://levela.yeremyan.net`.
- Keep `/updates/android.json` as the human-readable mirror for verification and debugging.
- `scripts/update-application.sh` is responsible for:
  - building the web app
  - removing `dist/downloads` before Android asset sync (website APK files must not be embedded inside the mobile APK)
  - syncing Capacitor Android assets
  - building the APK with `./gradlew clean assembleDebug` to avoid stale packaged assets
  - publishing both the legacy and versioned APK filenames
  - regenerating `public/updates/android.json`
  - regenerating `public/updates/android.js`
- APK size sanity check for releases:
  - verify the built APK does not contain `assets/public/downloads/*` entries
  - if APK size jumps unexpectedly (for example >2x from previous release), treat it as a packaging regression and inspect APK contents before publishing
- `scripts/release-bump.sh` updates the version source of truth in `src/lib/app-release.ts`, bumps the Android build number, and syncs `package.json` plus `package-lock.json`.
- The step-by-step human release guide lives in `docs/04-operations/dev/RELEASING.md`.
- After versioning changes, verify all three of these outputs together:
  - the APK filename linked on the live website
  - the live `/updates/android.json` manifest
  - the installed Android app's bundled version/build values

## 6. Deploy Payload Guardrails

- Never deploy a bloated `dist` archive to production when payload size is unexpectedly large.
- Before creating any VPS deploy tarball, run a payload preflight and verify:
  - `du -sh dist` is in the expected range for the current release
  - `dist/downloads` contains only:
    - `levela-debug.apk`
    - `levela-debug-${APP_RELEASE_ID}.apk`
- If old versioned APK files are present in `public/downloads` or `dist/downloads`, prune them before deploy.
- If the deploy tarball is unexpectedly large (for example >50 MB for this project), stop and investigate instead of uploading.
- Keep release backups on the VPS, but do not repeatedly upload historical APK archives inside new deploy bundles.

## 7. Agent Correction Notes

- When an agent discovers a repeated mistake or process gap, add a concrete prevention rule to this `AGENTS.md` file in the same session.
- Notes must include:
  - the failure pattern
  - the mandatory preflight/validation check
  - the stop condition that blocks repeating the same error
- Do not rely on memory alone for repeated-release safeguards; encode them as explicit written rules.

## 8. Local Dev Port Policy

- Default local development URL for this project is `http://localhost:8080`.
- Reuse port `8080` by default; do not open new Vite dev ports (such as `8081`, `8082`, etc.) for routine work.
- Before starting a new dev server, check whether an existing server is already running on `8080` and reuse it when available.
- Only use a different port when:
  - the user explicitly asks for another port, or
  - port `8080` is genuinely unavailable and cannot be freed quickly.
- If a fallback port is temporarily required, clearly state that reason and switch back to `8080` for normal workflows.
- After every implemented fix, verify the app is actually running before reporting completion:
  - ensure the dev server is up on `localhost:8080`
  - verify the relevant page URL responds (for example with `curl -I`)
  - do not declare the fix complete until runtime is confirmed

## 9. VPS Deploy Method Guard

- Failure pattern: deploying with plain user write operations to `/www/wwwroot/levela` can fail with permission errors, and `rsync` may not exist on the VPS.
- Mandatory preflight before deploy:
  - confirm SSH access to `soc-yeremyan-net`
  - check `sudo -n true` works
  - check whether `rsync` exists on the remote host
- Standard deploy fallback when `rsync` is missing:
  - package local `dist/` as tar
  - upload tar via `scp`
  - use `sudo` to clear `/www/wwwroot/levela` (preserve `.user.ini`)
  - extract tar into `/www/wwwroot/levela`
- Stop condition:
  - if passwordless `sudo` is unavailable, stop and do not attempt partial writes to `/www/wwwroot/levela`

## 10. Profile Mismatch Triage

- Failure pattern: web and phone show different Edit Profile identity data (role/photo/place) even after app update.
- Mandatory production check:
  - query `public.profiles` for all likely identities (for example current and legacy usernames) and compare `user_id`, `role`, `avatar_url`, `place_of_birth`, `country`, and `updated_at`
  - confirm whether the user is actually on a different account rather than a stale bundle
- Root-cause guard:
  - if duplicate accounts exist for the same person, do not assume frontend rendering drift first; verify account-level data mismatch before changing UI layout code
- Stop condition:
  - do not ship another UI-only fix for profile-card mismatch until the production profile rows are verified against the reported username/account

## 11. Mandatory Post-Fix Release + Git Sync

- Failure pattern: a fix is confirmed locally, but release/update propagation and/or Git sync is left incomplete.
- Mandatory sequence after every confirmed fix (no user reminder required):
  - run app/runtime verification on `http://localhost:8080` for the changed flow
  - if the change affects distributed app behavior (web/mobile), run the full update pipeline and deploy to VPS
  - when publishing mobile updates intended to be detected by installed clients, ensure release metadata is bumped first (`APP_VERSION`, `ANDROID_VERSION_CODE`, `APP_RELEASE_ID`)
  - commit all pending related changes in this repo (not just the last edited file)
  - push `main` to GitHub
  - verify live endpoints after deploy (including both update channels when enabled)
- Stop condition:
  - do not report completion until deploy + commit + push + live verification are all done
- Communication rule:
  - do not ask whether to perform commit/push/update once a fix is confirmed; execute this flow automatically
