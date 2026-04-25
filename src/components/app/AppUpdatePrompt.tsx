import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CURRENT_ANDROID_RELEASE,
  CURRENT_ANDROID_RELEASE_LABEL,
  formatReleaseLabel,
  isAndroidUpdateAvailable,
  shouldPromptForAndroidUpdate,
  type AndroidUpdateManifest,
} from '@/lib/app-updates';
import { loadManifestForUserUpdateChannel } from '@/lib/android-update-manifest';
import { canUseExternalAndroidApkUpdates, DISTRIBUTION_CHANNEL } from '@/lib/distribution';
import { getAppUpdateChannel, type AppUpdateChannel } from '@/lib/update-channel';

const DISMISSED_ANDROID_KEYS: Record<AppUpdateChannel, string> = {
  release: 'levela-dismissed-android-release',
  testing: 'levela-dismissed-android-testing',
};
const PENDING_ANDROID_RELEASE_KEY = 'levela-pending-android-release';
const UPDATE_INSTALL_GRACE_PERIOD_MS = 20 * 60 * 1000;
const STORAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

type PendingAndroidRelease = {
  releaseId: string;
  startedAt: number;
  channel: AppUpdateChannel;
};

let dismissedReleaseMemory: string | null = null;
let dismissedTestingMemory: string | null = null;
let pendingReleaseMemory: PendingAndroidRelease | null = null;
let promptedReleaseMemory: string | null = null;

function toCookieKey(key: string) {
  return `levela_${key.replace(/[^a-z0-9]+/gi, '_')}`;
}

function readCookieItem(key: string) {
  if (typeof document === 'undefined') return null;

  const cookieKey = `${toCookieKey(key)}=`;
  const parts = document.cookie.split(';');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(cookieKey)) continue;
    return decodeURIComponent(trimmed.slice(cookieKey.length));
  }

  return null;
}

function writeCookieItem(key: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${toCookieKey(key)}=${encodeURIComponent(value)}; Max-Age=${STORAGE_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function removeCookieItem(key: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${toCookieKey(key)}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readStorageItem(key: string) {
  try {
    const localValue = window.localStorage.getItem(key);
    if (localValue !== null) {
      return localValue;
    }
  } catch {
    // Fall back to cookies when localStorage is unavailable on some mobile WebView states.
  }

  try {
    return readCookieItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Fall through to cookie persistence.
  }

  try {
    writeCookieItem(key, value);
  } catch {
    // Ignore storage failures and fall back to in-memory state.
  }
}

function removeStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Fall through to cookie cleanup.
  }

  try {
    removeCookieItem(key);
  } catch {
    // Ignore storage access failures and fall back to in-memory state.
  }
}

function getDismissedReleaseId(channel: AppUpdateChannel) {
  const key = DISMISSED_ANDROID_KEYS[channel];
  const stored = readStorageItem(key);
  if (stored) {
    if (channel === 'release') dismissedReleaseMemory = stored;
    else dismissedTestingMemory = stored;
    return stored;
  }
  return channel === 'release' ? dismissedReleaseMemory : dismissedTestingMemory;
}

function acknowledgeRelease(releaseId: string, channel: AppUpdateChannel) {
  const key = DISMISSED_ANDROID_KEYS[channel];
  if (channel === 'release') dismissedReleaseMemory = releaseId;
  else dismissedTestingMemory = releaseId;
  writeStorageItem(key, releaseId);
}

function clearAcknowledgedRelease(channel: AppUpdateChannel) {
  const key = DISMISSED_ANDROID_KEYS[channel];
  if (channel === 'release') dismissedReleaseMemory = null;
  else dismissedTestingMemory = null;
  removeStorageItem(key);
}

function getPendingRelease(): PendingAndroidRelease | null {
  const raw = readStorageItem(PENDING_ANDROID_RELEASE_KEY);
  const source = raw ?? (pendingReleaseMemory ? JSON.stringify(pendingReleaseMemory) : null);

  if (!source) {
    return null;
  }

  try {
    const parsed = JSON.parse(source) as Partial<PendingAndroidRelease>;
    if (
      typeof parsed.releaseId !== 'string'
      || typeof parsed.startedAt !== 'number'
      || (parsed.channel !== 'release' && parsed.channel !== 'testing')
    ) {
      clearPendingRelease();
      return null;
    }
    pendingReleaseMemory = {
      releaseId: parsed.releaseId,
      startedAt: parsed.startedAt,
      channel: parsed.channel,
    };
    return pendingReleaseMemory;
  } catch {
    return pendingReleaseMemory;
  }
}

function markReleaseAsInstalling(releaseId: string, channel: AppUpdateChannel) {
  pendingReleaseMemory = {
    releaseId,
    startedAt: Date.now(),
    channel,
  };
  writeStorageItem(PENDING_ANDROID_RELEASE_KEY, JSON.stringify(pendingReleaseMemory));
}

function clearPendingRelease() {
  pendingReleaseMemory = null;
  removeStorageItem(PENDING_ANDROID_RELEASE_KEY);
}

export function AppUpdatePrompt() {
  const { t } = useLanguage();
  const [availableUpdate, setAvailableUpdate] = useState<{
    manifest: AndroidUpdateManifest;
    channel: AppUpdateChannel;
  } | null>(null);
  const [isLaunchingUpdate, setIsLaunchingUpdate] = useState(false);
  const updateLaunchLockRef = useRef(false);
  const releaseLaunchTimeoutRef = useRef<number | null>(null);
  const allowsExternalAndroidApkUpdates = useMemo(
    () => canUseExternalAndroidApkUpdates(DISTRIBUTION_CHANNEL),
    [],
  );
  const isAndroidNativeApp = useMemo(
    () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
    [],
  );
  const shouldUseExternalApkPrompt = isAndroidNativeApp && allowsExternalAndroidApkUpdates;

  const checkForUpdates = useCallback(async () => {
    if (!shouldUseExternalApkPrompt) {
      return;
    }

    try {
      const channel = getAppUpdateChannel();
      const manifest = await loadManifestForUserUpdateChannel();

      if (!manifest) {
        return;
      }

      const pendingRelease = getPendingRelease();
      if (pendingRelease) {
        const stillInstallingSameRelease =
          pendingRelease.channel === channel
          && pendingRelease.releaseId === manifest.releaseId
          && Date.now() - pendingRelease.startedAt < UPDATE_INSTALL_GRACE_PERIOD_MS;

        if (stillInstallingSameRelease) {
          setAvailableUpdate(null);
          return;
        }

        clearPendingRelease();
      }

      const dismissedReleaseId = getDismissedReleaseId(channel);
      const updateAvailable = isAndroidUpdateAvailable(CURRENT_ANDROID_RELEASE, manifest);

      if (updateAvailable && shouldPromptForAndroidUpdate(CURRENT_ANDROID_RELEASE, manifest, dismissedReleaseId)) {
        const promptedKey = `${channel}:${manifest.releaseId}`;
        if (promptedReleaseMemory === promptedKey) {
          return;
        }
        promptedReleaseMemory = promptedKey;
        setAvailableUpdate({ manifest, channel });
        return;
      }

      if (!updateAvailable && dismissedReleaseId === manifest.releaseId) {
        clearAcknowledgedRelease(channel);
      }

      if (!updateAvailable) {
        promptedReleaseMemory = null;
      }

      setAvailableUpdate(null);
    } catch {
      // Ignore update check failures so offline use remains unaffected.
    }
  }, [shouldUseExternalApkPrompt]);

  useEffect(() => {
    if (!shouldUseExternalApkPrompt) {
      setAvailableUpdate(null);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };

    const handleFocus = () => {
      void checkForUpdates();
    };

    void checkForUpdates();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);

      if (releaseLaunchTimeoutRef.current !== null) {
        window.clearTimeout(releaseLaunchTimeoutRef.current);
        releaseLaunchTimeoutRef.current = null;
      }
    };
  }, [checkForUpdates, shouldUseExternalApkPrompt]);

  if (!shouldUseExternalApkPrompt || !availableUpdate) {
    return null;
  }

  const handleLater = () => {
    acknowledgeRelease(availableUpdate.manifest.releaseId, availableUpdate.channel);
    promptedReleaseMemory = `${availableUpdate.channel}:${availableUpdate.manifest.releaseId}`;
    setAvailableUpdate(null);
  };

  const handleUpdate = () => {
    if (updateLaunchLockRef.current) return;
    updateLaunchLockRef.current = true;
    setIsLaunchingUpdate(true);

    // Suppress repeated prompts for the same release while install flow is in progress.
    acknowledgeRelease(availableUpdate.manifest.releaseId, availableUpdate.channel);
    markReleaseAsInstalling(availableUpdate.manifest.releaseId, availableUpdate.channel);
    promptedReleaseMemory = `${availableUpdate.channel}:${availableUpdate.manifest.releaseId}`;

    // On Android WebView, window.open can still return null even when it already launched
    // the external downloader, causing a second fallback navigation and duplicate prompts.
    // Use a single navigation path to avoid double download flows.
    const downloadUrl = new URL(availableUpdate.manifest.downloadUrl);
    downloadUrl.searchParams.set('install_attempt', Date.now().toString());
    window.location.assign(downloadUrl.toString());

    setAvailableUpdate(null);

    releaseLaunchTimeoutRef.current = window.setTimeout(() => {
      updateLaunchLockRef.current = false;
      setIsLaunchingUpdate(false);
      releaseLaunchTimeoutRef.current = null;
    }, 2500);
  };

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('appUpdate.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('appUpdate.description', {
              latestVersion: formatReleaseLabel(
                availableUpdate.manifest.version,
                availableUpdate.manifest.buildNumber,
              ),
              currentVersion: CURRENT_ANDROID_RELEASE_LABEL,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater} disabled={isLaunchingUpdate}>
            {t('appUpdate.later')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate} disabled={isLaunchingUpdate}>
            {t('appUpdate.updateNow')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
