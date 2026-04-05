# Releasing

This project keeps source code in GitHub, but APK files only on the local machine and on the VPS.

## Rules

- Do not commit or push APK files to GitHub.
- Keep release metadata in `src/lib/app-release.ts` as the source of truth.
- After each release, verify both the live website and the live Android download path on `https://levela.yeremyan.net`.

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
