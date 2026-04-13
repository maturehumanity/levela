import { APP_RELEASE_ID } from '@/lib/app-release';
import type { AppUpdateChannel } from '@/lib/update-channel';

export const PUBLIC_APP_ORIGIN = 'https://levela.yeremyan.net';
export const ANDROID_DOWNLOAD_FILENAME = `levela-debug-${APP_RELEASE_ID}.apk`;
export const ANDROID_DOWNLOAD_PATH = `/downloads/${ANDROID_DOWNLOAD_FILENAME}`;
export const ANDROID_DOWNLOAD_QUERY = `v=${encodeURIComponent(APP_RELEASE_ID)}`;
export const LEGACY_ANDROID_DOWNLOAD_PATH = '/downloads/levela-debug.apk';
export const ANDROID_DOWNLOAD_URL = new URL(`${ANDROID_DOWNLOAD_PATH}?${ANDROID_DOWNLOAD_QUERY}`, PUBLIC_APP_ORIGIN).toString();

export function getAndroidUpdateManifestPath(channel: AppUpdateChannel) {
  return channel === 'testing' ? '/updates/android-testing.json' : '/updates/android-release.json';
}

export function getAndroidUpdateScriptPath(channel: AppUpdateChannel) {
  return channel === 'testing' ? '/updates/android-testing.js' : '/updates/android-release.js';
}

export function getAndroidUpdateManifestUrl(channel: AppUpdateChannel) {
  return new URL(getAndroidUpdateManifestPath(channel), PUBLIC_APP_ORIGIN).toString();
}

export function getAndroidUpdateScriptUrl(channel: AppUpdateChannel) {
  return new URL(getAndroidUpdateScriptPath(channel), PUBLIC_APP_ORIGIN).toString();
}
