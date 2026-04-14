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
  isAndroidUpdateManifest,
  shouldPromptForAndroidUpdate,
  type AndroidUpdateManifest,
} from '@/lib/app-updates';
import { canUseExternalAndroidApkUpdates, DISTRIBUTION_CHANNEL } from '@/lib/distribution';
import { getAndroidUpdateScriptUrl } from '@/lib/downloads';
import type { AppUpdateChannel } from '@/lib/update-channel';
import { getAppUpdateChannel, onAppUpdateChannelChange } from '@/lib/update-channel';

const DISMISSED_ANDROID_RELEASE_KEY = 'levela-dismissed-android-release';
const PENDING_ANDROID_RELEASE_KEY = 'levela-pending-android-release';
const UPDATE_INSTALL_GRACE_PERIOD_MS = 20 * 60 * 1000;
const STORAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

type PendingAndroidRelease = {
  releaseId: string;
  startedAt: number;
};

let dismissedReleaseMemory: string | null = null;
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

function getDismissedReleaseId() {
  const stored = readStorageItem(DISMISSED_ANDROID_RELEASE_KEY);
  if (stored) {
    dismissedReleaseMemory = stored;
    return stored;
  }
  return dismissedReleaseMemory;
}

function acknowledgeRelease(releaseId: string) {
  dismissedReleaseMemory = releaseId;
  writeStorageItem(DISMISSED_ANDROID_RELEASE_KEY, releaseId);
}

function clearAcknowledgedRelease() {
  dismissedReleaseMemory = null;
  removeStorageItem(DISMISSED_ANDROID_RELEASE_KEY);
}

function getPendingRelease(): PendingAndroidRelease | null {
  const raw = readStorageItem(PENDING_ANDROID_RELEASE_KEY);
  const source = raw ?? (pendingReleaseMemory ? JSON.stringify(pendingReleaseMemory) : null);

  if (!source) {
    return null;
  }

  try {
    const parsed = JSON.parse(source) as Partial<PendingAndroidRelease>;
    if (typeof parsed.releaseId !== 'string' || typeof parsed.startedAt !== 'number') {
      return null;
    }
    pendingReleaseMemory = {
      releaseId: parsed.releaseId,
      startedAt: parsed.startedAt,
    };
    return pendingReleaseMemory;
  } catch {
    return pendingReleaseMemory;
  }
}

function markReleaseAsInstalling(releaseId: string) {
  pendingReleaseMemory = {
    releaseId,
    startedAt: Date.now(),
  };
  writeStorageItem(PENDING_ANDROID_RELEASE_KEY, JSON.stringify(pendingReleaseMemory));
}

function clearPendingRelease() {
  pendingReleaseMemory = null;
  removeStorageItem(PENDING_ANDROID_RELEASE_KEY);
}

function loadRemoteManifest(channel: AppUpdateChannel) {
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

export function AppUpdatePrompt() {
  const { t } = useLanguage();
  const [availableUpdate, setAvailableUpdate] = useState<AndroidUpdateManifest | null>(null);
  const [isLaunchingUpdate, setIsLaunchingUpdate] = useState(false);
  const [appUpdateChannel, setAppUpdateChannel] = useState(getAppUpdateChannel);
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

  useEffect(() => onAppUpdateChannelChange(setAppUpdateChannel), []);

  const checkForUpdates = useCallback(async () => {
    if (!shouldUseExternalApkPrompt) {
      return;
    }

    try {
      const manifest = await loadRemoteManifest(appUpdateChannel);

      if (!isAndroidUpdateManifest(manifest)) {
        return;
      }

      const pendingRelease = getPendingRelease();
      if (pendingRelease) {
        const stillInstallingSameRelease = pendingRelease.releaseId === manifest.releaseId
          && Date.now() - pendingRelease.startedAt < UPDATE_INSTALL_GRACE_PERIOD_MS;

        if (stillInstallingSameRelease) {
          setAvailableUpdate(null);
          return;
        }

        clearPendingRelease();
      }

      const dismissedReleaseId = getDismissedReleaseId();
      const updateAvailable = isAndroidUpdateAvailable(CURRENT_ANDROID_RELEASE, manifest);

      if (updateAvailable && shouldPromptForAndroidUpdate(CURRENT_ANDROID_RELEASE, manifest, dismissedReleaseId)) {
        if (promptedReleaseMemory === manifest.releaseId) {
          return;
        }
        promptedReleaseMemory = manifest.releaseId;
        setAvailableUpdate(manifest);
        return;
      }

      if (!updateAvailable && dismissedReleaseId === manifest.releaseId) {
        clearAcknowledgedRelease();
      }

      if (!updateAvailable) {
        promptedReleaseMemory = null;
      }

      setAvailableUpdate(null);
    } catch {
      // Ignore update check failures so offline use remains unaffected.
    }
  }, [appUpdateChannel, shouldUseExternalApkPrompt]);

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
    acknowledgeRelease(availableUpdate.releaseId);
    promptedReleaseMemory = availableUpdate.releaseId;
    setAvailableUpdate(null);
  };

  const handleUpdate = () => {
    if (updateLaunchLockRef.current) return;
    updateLaunchLockRef.current = true;
    setIsLaunchingUpdate(true);

    // Suppress repeated prompts for the same release while install flow is in progress.
    acknowledgeRelease(availableUpdate.releaseId);
    markReleaseAsInstalling(availableUpdate.releaseId);
    promptedReleaseMemory = availableUpdate.releaseId;

    // On Android WebView, window.open can still return null even when it already launched
    // the external downloader, causing a second fallback navigation and duplicate prompts.
    // Use a single navigation path to avoid double download flows.
    const downloadUrl = new URL(availableUpdate.downloadUrl);
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
              latestVersion: formatReleaseLabel(availableUpdate.version, availableUpdate.buildNumber),
              currentVersion: CURRENT_ANDROID_RELEASE_LABEL,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('appUpdate.body')}</p>

          <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{t('appUpdate.currentVersion')}</span>
              <span className="text-muted-foreground">{CURRENT_ANDROID_RELEASE_LABEL}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{t('appUpdate.latestVersion')}</span>
              <span className="text-muted-foreground">
                {formatReleaseLabel(availableUpdate.version, availableUpdate.buildNumber)}
              </span>
            </div>
          </div>

          {availableUpdate.notes && availableUpdate.notes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('appUpdate.releaseNotes')}</p>
              <ul className="space-y-2 pl-5 text-sm text-muted-foreground">
                {availableUpdate.notes.map((note) => (
                  <li key={note} className="list-disc">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

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
