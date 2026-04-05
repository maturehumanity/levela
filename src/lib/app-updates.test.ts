import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  isAndroidUpdateAvailable,
  shouldPromptForAndroidUpdate,
  type AndroidUpdateManifest,
} from '@/lib/app-updates';

const manifest: AndroidUpdateManifest = {
  platform: 'android',
  version: '0.1.1',
  buildNumber: 3,
  releaseId: '20260405-v0.1.1',
  downloadPath: '/downloads/levela-debug-20260405-v0.1.1.apk',
  downloadUrl: 'https://levela.yeremyan.net/downloads/levela-debug-20260405-v0.1.1.apk',
  publishedAt: '2026-04-05T00:00:00Z',
  notes: ['Test release'],
};

describe('app update helpers', () => {
  it('compares semantic versions with or without a v prefix', () => {
    expect(compareVersions('v0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.2.0', '0.1.9')).toBe(1);
    expect(compareVersions('0.1.0', '0.1.1')).toBe(-1);
  });

  it('detects updates by version before build number', () => {
    expect(isAndroidUpdateAvailable({ version: '0.1.0', buildNumber: 99 }, manifest)).toBe(true);
    expect(isAndroidUpdateAvailable({ version: '0.1.1', buildNumber: 2 }, manifest)).toBe(true);
    expect(isAndroidUpdateAvailable({ version: '0.1.1', buildNumber: 3 }, manifest)).toBe(false);
  });

  it('suppresses prompts for a dismissed release id', () => {
    expect(shouldPromptForAndroidUpdate({ version: '0.1.0', buildNumber: 2 }, manifest, null)).toBe(true);
    expect(shouldPromptForAndroidUpdate({ version: '0.1.0', buildNumber: 2 }, manifest, manifest.releaseId)).toBe(false);
  });
});
