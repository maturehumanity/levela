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
  - placing notes/docs in `docs/dev/` instead of the repo root
  - keeping temporary or tool-specific artifacts out of the project tree whenever possible
- If a new file is genuinely needed, choose the narrowest, most appropriate location and keep its purpose directly tied to the user’s request.

## 3. Persistent User Directives

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

## 4. Remote Environment

- Production for `levela.yeremyan.net` is not served by Lovable. Treat it as a VPS-managed deployment.
- Current known VPS entrypoint:
  - SSH host alias: `soc-yeremyan-net`
  - Host: `130.61.32.187`
  - Port: `26747`
  - User: `ubuntu`
  - Identity file: `~/.ssh/soc-yeremyan-net`
- The SSH key is passphrase-protected. In this environment, the server accepts the key, but non-interactive SSH fails unless that key is already unlocked in `ssh-agent`.
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
  - syncing Capacitor Android assets
  - building the APK
  - publishing both the legacy and versioned APK filenames
  - regenerating `public/updates/android.json`
  - regenerating `public/updates/android.js`
- `scripts/release-bump.sh` updates the version source of truth in `src/lib/app-release.ts`, bumps the Android build number, and syncs `package.json` plus `package-lock.json`.
- After versioning changes, verify all three of these outputs together:
  - the APK filename linked on the live website
  - the live `/updates/android.json` manifest
  - the installed Android app's bundled version/build values
