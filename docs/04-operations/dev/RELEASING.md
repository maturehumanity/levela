# Releasing

This project keeps source code in GitHub, but APK files only on the local machine and on the VPS.

## Rules

- Do not commit or push APK files to GitHub.
- Keep release metadata in `src/lib/app-release.ts` as the source of truth.
- After each release, verify both the live website and the live Android download path on `https://levela.yeremyan.net`.
- Set distribution channel per target build:
  - `VITE_DISTRIBUTION_CHANNEL=sideload` for direct APK distribution
  - `VITE_DISTRIBUTION_CHANNEL=play-store` for Google Play builds
  - `VITE_DISTRIBUTION_CHANNEL=app-store` for iOS App Store builds

## Android update policy (testing first, then production)

1. **Ship new work to testing first**  
   After bumping `src/lib/app-release.ts`, publish **only the testing channel** (or use the default `both` only when you intentionally want production to jump in the same step):

   ```bash
   LEVELA_UPDATE_CHANNEL=testing npm run update:application
   ```

   Deploy `public/updates/android-testing.json`, `android-testing.js`, and the matching testing APK under `public/downloads/` to the live site so sideload testers pick it up.

2. **Soak and verify**  
   Keep the build on the **Testing** track until you are satisfied there are **no bug reports** (or other release blockers) on that testing version.

3. **Promote the same tested build to production**  
   When the testing build is approved, copy it to the **release** manifest and APK name (same bytes, production URLs):

   ```bash
   npm run promote:android-testing-to-release
   ```

   Then deploy the updated `android-release.json`, `android-release.js`, `android.json`, `android.js`, and the new `levela-debug-release-*.apk` next to the testing APK.

4. **App behavior**  
   On native Android sideload builds, the app loads **only the manifest for the track** the user chose in **Settings** (Production vs Testing). Switching tracks triggers an immediate check against the server for that track’s latest version.

## Release Flow

1. Bump the release version.

```bash
npm run release:bump -- patch
```

You can also use `minor`, `major`, or an explicit version such as:

```bash
npm run release:bump -- 0.1.5
```

2. Build and publish the application artifacts locally.

```bash
npm run update:application
```

By default this now publishes both channels. You can override with:

```bash
LEVELA_UPDATE_CHANNEL=testing npm run update:application
LEVELA_UPDATE_CHANNEL=release npm run update:application
```

For direct website APK distribution, run with:

```bash
VITE_DISTRIBUTION_CHANNEL=sideload npm run update:application
```

This script:

- builds the web app
- syncs Capacitor Android assets
- builds the Android APK
- writes the versioned APK into `public/downloads/`
- regenerates `public/updates/android.json`
- regenerates `public/updates/android.js`
- rebuilds `dist/`

3. Deploy `dist/` to the VPS host path.

- SSH alias: `soc-yeremyan-net`
- Host web root: `/www/wwwroot/levela`
- Preserve `/www/wwwroot/levela/.user.ini`
- Do not write to `/srv/levela` inside the container

Example deploy flow:

```bash
tar -C dist -czf /tmp/levela-dist.tgz .
scp /tmp/levela-dist.tgz soc-yeremyan-net:~/levela-deploy/levela-dist.tgz
ssh soc-yeremyan-net '
set -euo pipefail
mkdir -p ~/levela-backups ~/levela-deploy
backup=~/levela-backups/levela-$(date +%Y%m%d-%H%M%S).tgz
sudo tar -C /www/wwwroot/levela -czf "$backup" .
sudo find /www/wwwroot/levela -mindepth 1 ! -name .user.ini -exec rm -rf {} +
sudo tar -C /www/wwwroot/levela -xzf ~/levela-deploy/levela-dist.tgz
sudo find /www/wwwroot/levela -mindepth 1 ! -name .user.ini -exec chown -R opc:opc {} +
'
```

4. Verify the live release.

Check:

- `https://levela.yeremyan.net`
- `https://levela.yeremyan.net/download`
- `https://levela.yeremyan.net/updates/android.json`
- the current versioned APK URL referenced by the manifest

Confirm:

- the site serves the new JS bundle
- the manifest version/build matches `src/lib/app-release.ts`
- the APK URL returns the new file
- the installed app shows the correct version/build in Settings

5. Commit and push source-only changes.

```bash
git add .
git commit -m "feat: release vX.Y.Z"
git push origin main
```

Before committing, confirm APK files are not staged:

```bash
git status --short
```

## Quick Commands

```bash
npm run release:bump -- patch
npm run update:application
git status --short
```
