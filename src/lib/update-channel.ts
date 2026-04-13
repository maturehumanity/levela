import { DISTRIBUTION_CHANNEL } from '@/lib/distribution';

export type AppUpdateChannel = 'release' | 'testing';

export const APP_UPDATE_CHANNEL_KEY = 'levela-app-update-channel';
export const APP_UPDATE_CHANNEL_EVENT = 'levela-app-update-channel-changed';

function defaultAppUpdateChannel(): AppUpdateChannel {
  return DISTRIBUTION_CHANNEL === 'sideload' ? 'testing' : 'release';
}

function normalizeAppUpdateChannel(value: string | null | undefined): AppUpdateChannel {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'release') return 'release';
  if (normalized === 'testing') return 'testing';
  return defaultAppUpdateChannel();
}

export function getAppUpdateChannel() {
  if (typeof window === 'undefined') return defaultAppUpdateChannel();
  try {
    return normalizeAppUpdateChannel(window.localStorage.getItem(APP_UPDATE_CHANNEL_KEY));
  } catch {
    return defaultAppUpdateChannel();
  }
}

export function setAppUpdateChannel(channel: AppUpdateChannel) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_UPDATE_CHANNEL_KEY, channel);
  } catch {
    // Ignore storage failures and keep runtime behavior.
  }

  window.dispatchEvent(
    new CustomEvent<{ channel: AppUpdateChannel }>(APP_UPDATE_CHANNEL_EVENT, {
      detail: { channel },
    }),
  );
}

export function toggleAppUpdateChannel(channel: AppUpdateChannel): AppUpdateChannel {
  return channel === 'testing' ? 'release' : 'testing';
}

export function onAppUpdateChannelChange(listener: (channel: AppUpdateChannel) => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<{ channel?: AppUpdateChannel }>;
    listener(normalizeAppUpdateChannel(customEvent.detail?.channel));
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== APP_UPDATE_CHANNEL_KEY) return;
    listener(normalizeAppUpdateChannel(event.newValue));
  };

  window.addEventListener(APP_UPDATE_CHANNEL_EVENT, handleEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(APP_UPDATE_CHANNEL_EVENT, handleEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}
