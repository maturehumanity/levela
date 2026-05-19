#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const allowProductionChange = process.env.LEVELA_ALLOW_PRODUCTION_RELEASE_CHANGE === 'true';
const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'HEAD~1';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function changedFiles() {
  try {
    git(['rev-parse', '--verify', baseRef]);
    return git(['diff', '--name-only', `${baseRef}...HEAD`])
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return git(['diff', '--name-only'])
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

const files = changedFiles();
const productionReleaseFiles = files.filter((file) =>
  [
    'public/updates/android-release.json',
    'public/updates/android-release.js',
    'public/updates/android.json',
    'public/updates/android.js',
  ].includes(file),
);

if (productionReleaseFiles.length > 0 && !allowProductionChange) {
  console.error('Production release files changed without explicit release approval:');
  for (const file of productionReleaseFiles) {
    console.error(`  - ${file}`);
  }
  console.error('');
  console.error('Normal flow: publish to Testing first, soak, then promote the tested build to Production.');
  console.error('Set LEVELA_ALLOW_PRODUCTION_RELEASE_CHANGE=true only in an approved production release job.');
  process.exit(1);
}

console.log('Release lifecycle guard passed.');
