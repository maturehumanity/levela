# OTA Updates Plan (Android Web Layer)

## Goal

Allow users to update most app changes without downloading a full APK, while preserving APK updates for native-layer changes.

## Current Baseline

- Native app is distributed via APK download from `https://levela.yeremyan.net/downloads/*`.
- Update prompt currently checks `https://levela.yeremyan.net/updates/android.js` for full APK updates.
- Release metadata source of truth is `src/lib/app-release.ts`.

## What Can and Cannot Be OTA

OTA-capable:
- React/TypeScript app logic
- CSS and static frontend assets
- i18n content
- Client-side routing/pages

APK-required:
- Capacitor plugin additions/updates
- Android permissions/manifest changes
- Native Java/Kotlin or Gradle changes
- Capacitor/Android SDK compatibility shifts

## Target Design

Use a hybrid update model with two channels:

1. `native` channel (existing)
- Full APK update path (already in place)
- Manifest remains `/updates/android.json` + `/updates/android.js`

2. `web-ota` channel (new)
- Signed and hashed web bundle package
- App downloads only the web bundle delta package (zip/tar)
- App verifies integrity, activates bundle, and restarts WebView

## Proposed OTA Manifest

New files:
- `/updates/web-android.json`
- `/updates/web-android.js` (optional mirror, same pattern as current)

Example `web-android.json`:

```json
{
  "platform": "android",
  "channel": "web-ota",
  "bundleVersion": "20260412-web.3",
  "bundlePath": "/updates/bundles/levela-web-20260412-web.3.zip",
  "bundleUrl": "https://levela.yeremyan.net/updates/bundles/levela-web-20260412-web.3.zip",
  "bundleSha256": "<hex>",
  "bundleSize": 18453210,
  "minNative": {
    "version": "0.1.4",
    "buildNumber": 6
  },
  "mandatory": false,
  "publishedAt": "2026-04-12T09:00:00Z",
  "notes": [
    "Profile card layout consistency fixes",
    "Theme persistence fixes"
  ]
}
```

## App-Side Runtime Flow

1. On app foreground/start, check OTA manifest.
2. Compare current OTA bundle version with manifest.
3. Verify `minNative` against installed app version/build.
4. If newer bundle and compatible:
- Download bundle to app data storage
- Verify SHA-256
- Unpack to versioned local directory
- Atomically switch active bundle pointer
- Prompt user to restart now (or auto-restart after consent)
5. On next launch, boot from active local bundle.
6. Mark update as healthy only after successful app start; if startup fails, rollback to previous bundle automatically.

## Rollback and Safety Rules

- Keep `current` and `previous` bundles locally.
- Use startup heartbeat marker:
  - set `pending_activation=true` before restart
  - clear it only after healthy app init
- If app crashes/does not clear marker, fallback to previous bundle.
- Never delete previous bundle until current bundle is confirmed healthy.

## Security Requirements

- HTTPS-only download URLs.
- Strict host allowlist: `levela.yeremyan.net`.
- Required SHA-256 hash validation before activation.
- Optional but recommended: signature verification (Ed25519) on manifest or bundle.
- Downgrade protection: ignore OTA bundle versions older than installed active bundle unless a signed rollback flag is set.

## UX Changes

Settings/About screen should display:
- Native version/build (APK shell)
- Active web bundle version
- Last OTA check time

Update prompt behavior:
- If OTA available and compatible: show "Update now" (small download)
- If native required: show existing APK update prompt
- If both available: prioritize native if `minNative` is unmet

## Build/Release Pipeline Changes

### New script responsibilities

Add script (example): `scripts/publish-web-ota.sh`
- Build web bundle artifact (zip)
- Compute `sha256` and `size`
- Emit `public/updates/web-android.json`
- Emit optional `public/updates/web-android.js`
- Copy bundle into `public/updates/bundles/`
- Prune old OTA bundles (keep latest N)

### Existing script updates

Update `scripts/update-application.sh` to:
- Keep current APK flow intact
- Optionally call OTA publish step
- Keep deploy payload small (already guarded)

### Deploy updates

Deploy must include:
- `dist/updates/web-android.json`
- `dist/updates/web-android.js` (if used)
- `dist/updates/bundles/*`

## Integration Points in Current Codebase

- Extend `src/lib/app-updates.ts` with OTA types and comparison helpers.
- Add OTA check/apply service in `src/lib/` (e.g., `ota-updates.ts`).
- Integrate into `src/components/app/AppUpdatePrompt.tsx`.
- Add Settings visibility for native vs web bundle version in `src/pages/Settings.tsx`.

## Delivery Plan

Phase 1 (foundation)
- Manifest schema, bundle generation script, server publishing.
- App can check OTA manifest and report availability only.

Phase 2 (apply updates)
- Download, hash verify, activate, restart flow.
- Local bundle switching and persistence.

Phase 3 (resilience)
- Rollback on failed startup.
- Telemetry/logging for update success/failure.

Phase 4 (hardening)
- Signature verification.
- Rollout controls (percentage/channel), emergency disable flag.

## Acceptance Criteria

- OTA release updates Edit Profile/UI behavior without APK install.
- Native-only change still requires APK and triggers existing prompt.
- Corrupted OTA bundle is rejected and never activated.
- Failed activation auto-rolls back to previous working bundle.
- Live manifests and Settings version labels are consistent.

## Operational Notes

- Keep APK updates as fallback always.
- Start with opt-in channel (internal/beta), then broaden.
- Document a one-command rollback procedure for production OTA bundle pointers.
