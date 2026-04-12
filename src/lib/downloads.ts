import { APP_RELEASE_ID } from '@/lib/app-release';

export const PUBLIC_APP_ORIGIN = 'https://levela.yeremyan.net';
export const ANDROID_DOWNLOAD_FILENAME = `levela-debug-${APP_RELEASE_ID}.apk`;
export const ANDROID_DOWNLOAD_PATH = `/downloads/${ANDROID_DOWNLOAD_FILENAME}`;
export const ANDROID_DOWNLOAD_QUERY = `v=${encodeURIComponent(APP_RELEASE_ID)}`;
export const LEGACY_ANDROID_DOWNLOAD_PATH = '/downloads/levela-debug.apk';
export const ANDROID_DOWNLOAD_URL = new URL(`${ANDROID_DOWNLOAD_PATH}?${ANDROID_DOWNLOAD_QUERY}`, PUBLIC_APP_ORIGIN).toString();
export const ANDROID_UPDATE_MANIFEST_PATH = '/updates/android.json';
export const ANDROID_UPDATE_MANIFEST_URL = new URL(ANDROID_UPDATE_MANIFEST_PATH, PUBLIC_APP_ORIGIN).toString();
export const ANDROID_UPDATE_SCRIPT_PATH = '/updates/android.js';
export const ANDROID_UPDATE_SCRIPT_URL = new URL(ANDROID_UPDATE_SCRIPT_PATH, PUBLIC_APP_ORIGIN).toString();
