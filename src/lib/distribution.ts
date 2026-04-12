export type DistributionChannel = 'sideload' | 'play-store' | 'app-store';

const DEFAULT_DISTRIBUTION_CHANNEL: DistributionChannel = 'sideload';

function normalizeDistributionChannel(raw: string | undefined | null): DistributionChannel {
  const normalized = (raw || '').trim().toLowerCase();
  if (normalized === 'play-store') return 'play-store';
  if (normalized === 'app-store') return 'app-store';
  return DEFAULT_DISTRIBUTION_CHANNEL;
}

export const DISTRIBUTION_CHANNEL = normalizeDistributionChannel(import.meta.env.VITE_DISTRIBUTION_CHANNEL);

export function canUseExternalAndroidApkUpdates(channel: DistributionChannel) {
  return channel === 'sideload';
}
