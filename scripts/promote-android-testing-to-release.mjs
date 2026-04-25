#!/usr/bin/env node
/**
 * Promotes the current **testing** Android manifest + APK to **production** (release) files.
 * Run only after the testing build has soaked and there are no open bug reports on that testing version.
 *
 * Usage (from repo root):
 *   node scripts/promote-android-testing-to-release.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const origin = 'https://levela.yeremyan.net';

const testingJsonPath = path.join(root, 'public/updates/android-testing.json');
const downloadsDir = path.join(root, 'public/downloads');
const updatesDir = path.join(root, 'public/updates');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeUpdateJs(filePath, manifest) {
  fs.writeFileSync(
    filePath,
    `window.__LEVELA_ANDROID_UPDATE__ = ${JSON.stringify(manifest, null, 2)};\n`,
    'utf8',
  );
}

function main() {
  if (!fs.existsSync(testingJsonPath)) {
    console.error(`Missing ${testingJsonPath}`);
    process.exit(1);
  }

  const testing = JSON.parse(fs.readFileSync(testingJsonPath, 'utf8'));
  const { releaseId, version, versionTag, buildNumber, publishedAt, notes } = testing;
  if (!releaseId || typeof buildNumber !== 'number') {
    console.error('Invalid android-testing.json: need releaseId and buildNumber');
    process.exit(1);
  }

  const testingApkName = `levela-debug-testing-${releaseId}.apk`;
  const releaseApkName = `levela-debug-release-${releaseId}.apk`;
  const testingApk = path.join(downloadsDir, testingApkName);
  const releaseApk = path.join(downloadsDir, releaseApkName);

  if (!fs.existsSync(testingApk)) {
    console.error(`Missing testing APK: ${testingApk}`);
    process.exit(1);
  }

  fs.copyFileSync(testingApk, releaseApk);
  console.log(`Copied ${testingApkName} -> ${releaseApkName}`);

  const downloadPath = `/downloads/${releaseApkName}`;
  const downloadUrl = `${origin}${downloadPath}?v=${encodeURIComponent(releaseId)}`;

  const releaseManifest = {
    platform: 'android',
    version,
    versionTag,
    buildNumber,
    releaseId,
    downloadPath,
    downloadUrl,
    publishedAt,
    notes,
  };

  writeJson(path.join(updatesDir, 'android-release.json'), releaseManifest);
  writeUpdateJs(path.join(updatesDir, 'android-release.js'), releaseManifest);
  writeJson(path.join(updatesDir, 'android.json'), releaseManifest);
  writeUpdateJs(path.join(updatesDir, 'android.js'), releaseManifest);

  console.log('Wrote android-release.json, android-release.js, android.json, android.js');
  console.log('Next: deploy dist + public/downloads + public/updates to the web host, then rebuild web if needed.');
}

main();
