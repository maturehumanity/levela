import { useEffect } from 'react';
import { useTheme } from 'next-themes';

const THEME_STORAGE_KEY = 'levela-theme-v1';
const LEGACY_THEME_STORAGE_KEYS = ['theme'];
const THEME_COOKIE_KEY = 'levela-theme';
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type ThemeValue = 'light' | 'dark' | 'system';

function isThemeValue(value: unknown): value is ThemeValue {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readCookieTheme() {
  if (typeof document === 'undefined') return null;
  const cookieKey = `${THEME_COOKIE_KEY}=`;
  const parts = document.cookie.split(';');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(cookieKey)) continue;
    const rawValue = decodeURIComponent(trimmed.slice(cookieKey.length));
    return isThemeValue(rawValue) ? rawValue : null;
  }

  return null;
}

function writeCookieTheme(theme: ThemeValue) {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(theme)}; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function readLocalStorageTheme(key: string) {
  try {
    const value = window.localStorage.getItem(key);
    return isThemeValue(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLocalStorageTheme(key: string, value: ThemeValue) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures so theme changes still apply in-memory.
  }
}

function readStoredTheme() {
  const primary = readLocalStorageTheme(THEME_STORAGE_KEY);
  if (primary) return primary;

  for (const legacyKey of LEGACY_THEME_STORAGE_KEYS) {
    const legacyValue = readLocalStorageTheme(legacyKey);
    if (legacyValue) return legacyValue;
  }

  return readCookieTheme();
}

function persistTheme(theme: ThemeValue) {
  writeLocalStorageTheme(THEME_STORAGE_KEY, theme);
  LEGACY_THEME_STORAGE_KEYS.forEach((legacyKey) => writeLocalStorageTheme(legacyKey, theme));
  writeCookieTheme(theme);
}

export function ThemeStorageSync() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTheme = readStoredTheme();
    if (!storedTheme) return;

    persistTheme(storedTheme);
    if (theme !== storedTheme) {
      setTheme(storedTheme);
    }
  }, [setTheme, theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isThemeValue(theme)) return;

    persistTheme(theme);
  }, [theme]);

  return null;
}
