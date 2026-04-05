export const PUBLIC_APP_ORIGIN = 'https://levela.yeremyan.net';
export const APP_RELEASE_ID = '20260405-5cb7dd3';
export const ANDROID_DOWNLOAD_FILENAME = `levela-debug-${APP_RELEASE_ID}.apk`;
export const ANDROID_DOWNLOAD_PATH = `/downloads/${ANDROID_DOWNLOAD_FILENAME}`;
export const LEGACY_ANDROID_DOWNLOAD_PATH = '/downloads/levela-debug.apk';
export const ANDROID_DOWNLOAD_URL = new URL(ANDROID_DOWNLOAD_PATH, PUBLIC_APP_ORIGIN).toString();
