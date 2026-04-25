/** Sideload builds always follow the testing update manifest (`android-testing`). */
export type AppUpdateChannel = 'release' | 'testing';

export const APP_UPDATE_CHANNEL_KEY = 'levela-app-update-channel';
export const APP_UPDATE_CHANNEL_EVENT = 'levela-app-update-channel-changed';

export function getAppUpdateChannel(): AppUpdateChannel {
  return 'testing';
}

export function setAppUpdateChannel(_channel: AppUpdateChannel) {}

export function toggleAppUpdateChannel(channel: AppUpdateChannel): AppUpdateChannel {
  return channel === 'testing' ? 'release' : 'testing';
}

export function onAppUpdateChannelChange(_listener: (channel: AppUpdateChannel) => void) {
  return () => {};
}
