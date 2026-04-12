import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { ANDROID_UPDATE_SCRIPT_URL } from '@/lib/downloads';

const DISMISSED_ANDROID_RELEASE_KEY = 'levela-dismissed-android-release';
const PENDING_ANDROID_RELEASE_KEY = 'levela-pending-android-release';
const UPDATE_INSTALL_GRACE_PERIOD_MS = 20 * 60 * 1000;

type PendingAndroidRelease = {
  releaseId: string;
  startedAt: number;
};

let dismissedReleaseMemory: string | null = null;
let pendingReleaseMemory: PendingAndroidRelease | null = null;

function readStorageItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and fall back to in-memory state.
  }
}

function removeStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and fall back to in-memory state.
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

function loadRemoteManifest() {
  return new Promise<unknown>((resolve, reject) => {
    const script = document.createElement('script');
    const scriptUrl = new URL(ANDROID_UPDATE_SCRIPT_URL);
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
      const manifest = await loadRemoteManifest();

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
        setAvailableUpdate(manifest);
        return;
      }

      if (!updateAvailable && dismissedReleaseId === manifest.releaseId) {
        clearAcknowledgedRelease();
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
    };
  }, [checkForUpdates, shouldUseExternalApkPrompt]);

  if (!shouldUseExternalApkPrompt || !availableUpdate) {
    return null;
  }

  const handleLater = () => {
    acknowledgeRelease(availableUpdate.releaseId);
    setAvailableUpdate(null);
  };

  const handleUpdate = () => {
    // Suppress repeated prompts for the same release while install flow is in progress.
    acknowledgeRelease(availableUpdate.releaseId);
    markReleaseAsInstalling(availableUpdate.releaseId);

    const popup = window.open(availableUpdate.downloadUrl, '_blank', 'noopener,noreferrer');

    if (!popup) {
      window.location.assign(availableUpdate.downloadUrl);
    }

    setAvailableUpdate(null);
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
          <AlertDialogCancel onClick={handleLater}>{t('appUpdate.later')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate}>{t('appUpdate.updateNow')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
