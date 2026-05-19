export type AppUpdateChannel = 'release' | 'testing';

export const APP_UPDATE_CHANNEL_KEY = 'levela-app-update-channel';
export const APP_UPDATE_CHANNEL_EVENT = 'levela-app-update-channel-changed';
export const TEST_CHANNEL_AUTO_RETURN_MS = 2 * 60 * 60 * 1000;

type StoredAppUpdateChannel = {
  channel: AppUpdateChannel;
  selectedAt: number;
  expiresAt: number | null;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function normalizeChannel(raw: unknown): AppUpdateChannel {
  return raw === 'testing' ? 'testing' : 'release';
}

function buildStoredChannel(channel: AppUpdateChannel, now = Date.now()): StoredAppUpdateChannel {
  return {
    channel,
    selectedAt: now,
    expiresAt: channel === 'testing' ? now + TEST_CHANNEL_AUTO_RETURN_MS : null,
  };
}

function parseStoredChannel(raw: string | null): StoredAppUpdateChannel | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAppUpdateChannel>;
    const channel = normalizeChannel(parsed.channel);
    return {
      channel,
      selectedAt: typeof parsed.selectedAt === 'number' ? parsed.selectedAt : Date.now(),
      expiresAt:
        channel === 'testing' && typeof parsed.expiresAt === 'number'
          ? parsed.expiresAt
          : channel === 'testing'
            ? Date.now() + TEST_CHANNEL_AUTO_RETURN_MS
            : null,
    };
  } catch {
    return buildStoredChannel(normalizeChannel(raw));
  }
}

function readStoredChannel(): StoredAppUpdateChannel {
  if (!isBrowser()) return buildStoredChannel('release');

  try {
    const stored = parseStoredChannel(window.localStorage.getItem(APP_UPDATE_CHANNEL_KEY));
    if (!stored) return buildStoredChannel('release');

    if (stored.channel === 'testing' && stored.expiresAt !== null && Date.now() >= stored.expiresAt) {
      const releaseChannel = buildStoredChannel('release');
      window.localStorage.setItem(APP_UPDATE_CHANNEL_KEY, JSON.stringify(releaseChannel));
      return releaseChannel;
    }

    return stored;
  } catch {
    return buildStoredChannel('release');
  }
}

export function getAppUpdateChannel(): AppUpdateChannel {
  return readStoredChannel().channel;
}

export function getAppUpdateChannelExpiresAt(): number | null {
  return readStoredChannel().expiresAt;
}

export function setAppUpdateChannel(channel: AppUpdateChannel) {
  if (!isBrowser()) return;

  const next = buildStoredChannel(channel);
  try {
    window.localStorage.setItem(APP_UPDATE_CHANNEL_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures; the current page can still dispatch the event.
  }

  window.dispatchEvent(
    new CustomEvent(APP_UPDATE_CHANNEL_EVENT, {
      detail: next,
    }),
  );
}

export function toggleAppUpdateChannel(channel: AppUpdateChannel): AppUpdateChannel {
  return channel === 'testing' ? 'release' : 'testing';
}

export function onAppUpdateChannelChange(listener: (channel: AppUpdateChannel) => void) {
  if (!isBrowser()) return () => {};

  const handler = () => {
    listener(getAppUpdateChannel());
  };

  window.addEventListener(APP_UPDATE_CHANNEL_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(APP_UPDATE_CHANNEL_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
