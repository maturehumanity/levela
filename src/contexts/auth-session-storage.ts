export type AccountType = 'personal' | 'business' | 'linked';

export type StoredAccountSession = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  updated_at: string;
  email: string | null;
  profile_id: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_type: AccountType;
};

export type KnownAccountSession = {
  userId: string;
  profileId: string | null;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  accountType: AccountType;
  updatedAt: string;
};

export const ACCOUNT_SESSION_MAP_KEY = 'levela:account-session-map:v1';
export const ACCOUNT_SWITCH_STACK_KEY = 'levela:account-switch-stack:v1';
export const MAX_ACCOUNT_SESSIONS = 8;
export const MAX_ACCOUNT_SWITCH_STACK = 8;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function readStoredJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

export function clearStoredValue(key: string) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access failures.
  }
}

export function readStoredSessionMap() {
  return readStoredJson<Record<string, StoredAccountSession>>(ACCOUNT_SESSION_MAP_KEY, {});
}

export function readStoredSwitchStack() {
  return readStoredJson<StoredAccountSession[]>(ACCOUNT_SWITCH_STACK_KEY, []);
}
