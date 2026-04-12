import { describe, expect, it } from 'vitest';

import { canUseExternalAndroidApkUpdates } from '@/lib/distribution';

describe('distribution policy helpers', () => {
  it('allows external APK updates only for sideload channel', () => {
    expect(canUseExternalAndroidApkUpdates('sideload')).toBe(true);
    expect(canUseExternalAndroidApkUpdates('play-store')).toBe(false);
    expect(canUseExternalAndroidApkUpdates('app-store')).toBe(false);
  });
});
