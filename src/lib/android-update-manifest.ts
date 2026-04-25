import { isAndroidUpdateManifest, type AndroidUpdateManifest } from '@/lib/app-updates';
import { getAndroidUpdateManifestUrl, getAndroidUpdateScriptUrl } from '@/lib/downloads';
import { getAppUpdateChannel, type AppUpdateChannel } from '@/lib/update-channel';

function loadManifestViaScript(channel: AppUpdateChannel) {
  return new Promise<unknown>((resolve, reject) => {
    const script = document.createElement('script');
    const scriptUrl = new URL(getAndroidUpdateScriptUrl(channel));
    const updateWindow = window as typeof window & {
      __LEVELA_ANDROID_UPDATE__?: unknown;
    };

    delete updateWindow.__LEVELA_ANDROID_UPDATE__;

    scriptUrl.searchParams.set('ts', Date.now().toString());
    script.src = scriptUrl.toString();
    script.async = true;

    script.onload = () => {
      resolve(updateWindow.__LEVELA_ANDROID_UPDATE__);
      script.remove();
    };

    script.onerror = () => {
      script.remove();
      reject(new Error('Could not load the Android update manifest.'));
    };

    document.head.appendChild(script);
  });
}

/** Load remote manifest: JSON fetch first, then `.js` assignment (WebView-friendly fallback). */
export async function loadManifestForUserUpdateChannel(): Promise<AndroidUpdateManifest | null> {
  const channel = getAppUpdateChannel();
  const jsonUrl = getAndroidUpdateManifestUrl(channel);

  try {
    const response = await fetch(jsonUrl, { cache: 'no-store' });
    if (response.ok) {
      const raw: unknown = await response.json();
      if (isAndroidUpdateManifest(raw)) {
        return raw;
      }
    }
  } catch {
    /* fall through to script */
  }

  try {
    const raw = await loadManifestViaScript(channel);
    return isAndroidUpdateManifest(raw) ? raw : null;
  } catch {
    return null;
  }
}
