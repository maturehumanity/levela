import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { type LanguageCode } from '@/lib/i18n';
import { resolveEffectivePermissions, rolePermissionMap, type AppPermission, type AppRole } from '@/lib/access-control';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  sex?: string | null;
  country: string | null;
  country_code?: string | null;
  language_code: LanguageCode | null;
  phone_country_code?: string | null;
  phone_number?: string | null;
  phone_e164?: string | null;
  official_id?: string | null;
  social_security_number?: string | null;
  deleted_at?: string | null;
  deletion_reason?: string | null;
  full_name_change_count?: number | null;
  full_name_last_changed_at?: string | null;
  username_last_changed_at?: string | null;
  last_active_at?: string | null;
  is_verified: boolean;
  is_admin: boolean;
  role: AppRole;
  custom_permissions: AppPermission[];
  granted_permissions: AppPermission[];
  denied_permissions: AppPermission[];
  effective_permissions: AppPermission[];
  created_at: string;
  updated_at: string;
}

type AccountType = 'personal' | 'business' | 'linked';

type SignInOptions = {
  preserveCurrentSession?: boolean;
};

type StoredAccountSession = {
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    credentials: {
      email?: string;
      phoneNumber?: string;
      phoneCountryCode?: string;
      phoneE164?: string;
    },
    password: string,
    metadata?: {
      full_name?: string;
      date_of_birth?: string;
      country?: string;
      country_code?: string;
      language_code?: LanguageCode;
      phone_country_code?: string;
      phone_number?: string;
      phone_e164?: string;
      terms_accepted_at?: string;
      terms_version?: string;
    }
  ) => Promise<{ error: Error | null }>;
  signIn: (identifier: string, password: string, options?: SignInOptions) => Promise<{ error: Error | null }>;
  signInWithOtp: (
    payload: { email: string; token: string; type: 'magiclink' },
    options?: SignInOptions,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchBackToPreviousAccount: () => Promise<{ error: Error | null }>;
  switchToKnownAccount: (targetUserId: string, options?: SignInOptions) => Promise<{ error: Error | null }>;
  canSwitchBack: boolean;
  knownAccountSessions: KnownAccountSession[];
  pruneKnownAccountSessions: (validProfileIds: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCOUNT_SESSION_MAP_KEY = 'levela:account-session-map:v1';
const ACCOUNT_SWITCH_STACK_KEY = 'levela:account-switch-stack:v1';
const MAX_ACCOUNT_SESSIONS = 8;
const MAX_ACCOUNT_SWITCH_STACK = 8;

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

function writeStoredJson(key: string, value: unknown) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

function clearStoredValue(key: string) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access failures.
  }
}

function readStoredSessionMap() {
  return readStoredJson<Record<string, StoredAccountSession>>(ACCOUNT_SESSION_MAP_KEY, {});
}

function readStoredSwitchStack() {
  return readStoredJson<StoredAccountSession[]>(ACCOUNT_SWITCH_STACK_KEY, []);
}

function isAbortLikeError(error: { message?: string | null; details?: string | null } | null | undefined) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('aborterror') || message.includes('signal is aborted');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountSessionMap, setAccountSessionMap] = useState<Record<string, StoredAccountSession>>(() => readStoredSessionMap());
  const [accountSwitchStack, setAccountSwitchStack] = useState<StoredAccountSession[]>(() => readStoredSwitchStack());
  const supportsLastActiveRef = useRef(true);
  const profileRefreshInFlightRef = useRef<Promise<Profile | null> | null>(null);
  const lastProfileRefreshAtRef = useRef(0);
  const lastProfileTouchAtRef = useRef(0);

  const knownAccountSessions = useMemo(
    () =>
      Object.values(accountSessionMap)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .map(
          (item): KnownAccountSession => ({
            userId: item.user_id,
            profileId: item.profile_id,
            username: item.username,
            fullName: item.full_name,
            avatarUrl: item.avatar_url,
            email: item.email,
            accountType: item.account_type,
            updatedAt: item.updated_at,
          }),
        ),
    [accountSessionMap],
  );

  const canSwitchBack = accountSwitchStack.length > 0;

  const persistAccountSessionMap = useCallback((next: Record<string, StoredAccountSession>) => {
    setAccountSessionMap(next);
    writeStoredJson(ACCOUNT_SESSION_MAP_KEY, next);
  }, []);

  const updateAccountSessionMap = useCallback(
    (
      updater: (current: Record<string, StoredAccountSession>) => Record<string, StoredAccountSession>,
    ) => {
      setAccountSessionMap((current) => {
        const next = updater(current);
        writeStoredJson(ACCOUNT_SESSION_MAP_KEY, next);
        return next;
      });
    },
    [],
  );

  const persistAccountSwitchStack = useCallback((next: StoredAccountSession[]) => {
    setAccountSwitchStack(next);
    writeStoredJson(ACCOUNT_SWITCH_STACK_KEY, next);
  }, []);

  const updateAccountSwitchStack = useCallback(
    (
      updater: (current: StoredAccountSession[]) => StoredAccountSession[],
    ) => {
      setAccountSwitchStack((current) => {
        const next = updater(current);
        writeStoredJson(ACCOUNT_SWITCH_STACK_KEY, next);
        return next;
      });
    },
    [],
  );

  const pruneKnownAccountSessions = useCallback((validProfileIds: string[]) => {
    const allowed = new Set(validProfileIds);
    updateAccountSessionMap((current) => {
      const next: Record<string, StoredAccountSession> = {};
      Object.values(current).forEach((session) => {
        if (session.profile_id && allowed.has(session.profile_id)) {
          next[session.user_id] = session;
        }
      });
      return next;
    });
  }, [updateAccountSessionMap]);

  const clearAccountSwitchState = useCallback(() => {
    setAccountSwitchStack([]);
    clearStoredValue(ACCOUNT_SWITCH_STACK_KEY);
  }, []);

  const buildStoredSession = useCallback(
    (
      inputSession: Session,
      options?: {
        profileSnapshot?: Profile | null;
        accountType?: AccountType;
      },
    ): StoredAccountSession => ({
      user_id: inputSession.user.id,
      access_token: inputSession.access_token,
      refresh_token: inputSession.refresh_token,
      expires_at: inputSession.expires_at ?? null,
      updated_at: new Date().toISOString(),
      email: inputSession.user.email ?? null,
      profile_id: options?.profileSnapshot?.id ?? null,
      username: options?.profileSnapshot?.username ?? null,
      full_name: options?.profileSnapshot?.full_name ?? null,
      avatar_url: options?.profileSnapshot?.avatar_url ?? null,
      account_type: options?.accountType ?? 'linked',
    }),
    [],
  );

  const captureCurrentSession = useCallback(
    (options?: {
      profileSnapshot?: Profile | null;
      accountType?: AccountType;
    }) => {
      if (!session?.user) return null;
      return buildStoredSession(session, options);
    },
    [buildStoredSession, session],
  );

  const storeSessionSnapshot = useCallback((nextSnapshot: StoredAccountSession) => {
    updateAccountSessionMap((current) =>
      Object.values({
        ...current,
        [nextSnapshot.user_id]: nextSnapshot,
      })
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, MAX_ACCOUNT_SESSIONS)
        .reduce<Record<string, StoredAccountSession>>((accumulator, item) => {
          accumulator[item.user_id] = item;
          return accumulator;
        }, {}),
    );
  }, [updateAccountSessionMap]);

  const pushSwitchStackSnapshot = useCallback((nextSnapshot: StoredAccountSession) => {
    updateAccountSwitchStack((current) => {
      const deduped = current.filter((item) => item.user_id !== nextSnapshot.user_id);
      return [nextSnapshot, ...deduped].slice(0, MAX_ACCOUNT_SWITCH_STACK);
    });
  }, [updateAccountSwitchStack]);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (!isAbortLikeError(error)) {
        console.error('Error fetching profile:', error);
      }
      return null;
    }

    const typedProfile = data as Omit<Profile, 'effective_permissions'>;

    const { data: effectivePermissionRows, error: effectivePermissionsError } = await supabase.rpc(
      'current_app_permissions',
    );

    if (effectivePermissionsError) {
      if (!isAbortLikeError(effectivePermissionsError)) {
        console.error('Error fetching effective permissions:', effectivePermissionsError);
      }
    }

    const effectivePermissions = Array.isArray(effectivePermissionRows)
      ? (effectivePermissionRows as AppPermission[])
      : resolveEffectivePermissions(
          typedProfile.role,
          rolePermissionMap[typedProfile.role],
          typedProfile.granted_permissions || [],
          typedProfile.denied_permissions || [],
          typedProfile.custom_permissions || [],
        );

    return {
      ...typedProfile,
      effective_permissions: effectivePermissions,
    } as Profile;
  }, []);

  const touchProfileActivity = useCallback(async (userId: string) => {
    if (!supportsLastActiveRef.current) return;
    const now = Date.now();
    if (now - lastProfileTouchAtRef.current < 30_000) return;
    lastProfileTouchAtRef.current = now;

    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      if (error.message?.toLowerCase().includes('last_active_at')) {
        supportsLastActiveRef.current = false;
        return;
      }
      if (!isAbortLikeError(error)) {
        console.error('Error updating last active timestamp:', error);
      }
    }
  }, []);

  const refreshProfileForUser = useCallback(async (userId: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastProfileRefreshAtRef.current < 1_500) {
      return profileRefreshInFlightRef.current ?? null;
    }

    if (profileRefreshInFlightRef.current) {
      return profileRefreshInFlightRef.current;
    }

    lastProfileRefreshAtRef.current = now;
    const nextRefresh = (async () => {
      const profileData = await fetchProfile(userId);
      if (profileData) {
        setProfile(profileData);
      }
      return profileData;
    })();

    profileRefreshInFlightRef.current = nextRefresh;
    try {
      return await nextRefresh;
    } finally {
      if (profileRefreshInFlightRef.current === nextRefresh) {
        profileRefreshInFlightRef.current = null;
      }
    }
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await refreshProfileForUser(user.id);
    }
  }, [refreshProfileForUser, user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          storeSessionSnapshot(
            buildStoredSession(currentSession, {
              accountType: 'linked',
            }),
          );
        } else if (event === 'SIGNED_OUT') {
          clearAccountSwitchState();
        }

        const shouldRefreshProfile =
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED' ||
          event === 'INITIAL_SESSION';

        if (currentSession?.user && shouldRefreshProfile) {
          void refreshProfileForUser(currentSession.user.id, true).finally(() => {
            setLoading(false);
          });
        } else if (currentSession?.user) {
          setLoading(false);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        storeSessionSnapshot(
          buildStoredSession(currentSession, {
            accountType: 'personal',
          }),
        );
      }

      if (currentSession?.user) {
        refreshProfileForUser(currentSession.user.id, true).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [buildStoredSession, clearAccountSwitchState, refreshProfileForUser, storeSessionSnapshot]);

  useEffect(() => {
    if (!user) return;

    void touchProfileActivity(user.id);

    const interval = window.setInterval(() => {
      void touchProfileActivity(user.id);
    }, 2 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void touchProfileActivity(user.id);
        void refreshProfileForUser(user.id, true);
      }
    };

    const handleFocus = () => {
      void touchProfileActivity(user.id);
      void refreshProfileForUser(user.id, true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshProfileForUser, touchProfileActivity, user]);

  useEffect(() => {
    if (!user?.id) return;

    const profileChannel = supabase
      .channel(`profile-sync:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshProfileForUser(user.id, true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [refreshProfileForUser, user?.id]);

  useEffect(() => {
    if (!session?.user || !profile) return;

    const currentSnapshot = accountSessionMap[session.user.id];
    const nextSnapshot = buildStoredSession(session, {
      profileSnapshot: profile,
      accountType: 'personal',
    });

    const snapshotChanged =
      !currentSnapshot ||
      currentSnapshot.profile_id !== nextSnapshot.profile_id ||
      currentSnapshot.username !== nextSnapshot.username ||
      currentSnapshot.full_name !== nextSnapshot.full_name ||
      currentSnapshot.avatar_url !== nextSnapshot.avatar_url ||
      currentSnapshot.account_type !== nextSnapshot.account_type ||
      currentSnapshot.access_token !== nextSnapshot.access_token ||
      currentSnapshot.refresh_token !== nextSnapshot.refresh_token ||
      currentSnapshot.expires_at !== nextSnapshot.expires_at;

    if (snapshotChanged) {
      storeSessionSnapshot(nextSnapshot);
    }
  }, [accountSessionMap, buildStoredSession, profile, session, storeSessionSnapshot]);

  const signUp = async (
    credentials: {
      email?: string;
      phoneNumber?: string;
      phoneCountryCode?: string;
      phoneE164?: string;
    },
    password: string,
    metadata?: {
      full_name?: string;
      date_of_birth?: string;
      country?: string;
      country_code?: string;
      language_code?: LanguageCode;
      phone_country_code?: string;
      phone_number?: string;
      phone_e164?: string;
      terms_accepted_at?: string;
      terms_version?: string;
    },
  ) => {
    const normalizedEmail = credentials.email?.trim().toLowerCase();
    const normalizedPhoneDigits = credentials.phoneNumber?.replace(/\D/g, '') || '';
    const syntheticEmail = normalizedPhoneDigits
      ? `phone-${normalizedPhoneDigits}@phone.levela.local`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail || syntheticEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          ...metadata,
          phone_country_code: metadata?.phone_country_code ?? credentials.phoneCountryCode,
          phone_number: metadata?.phone_number ?? credentials.phoneNumber,
          phone_e164: metadata?.phone_e164 ?? credentials.phoneE164,
          contact_method: normalizedEmail ? 'email' : 'phone',
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (identifier: string, password: string, options?: SignInOptions) => {
    const trimmedIdentifier = identifier.trim();
    let email = trimmedIdentifier;
    const previousSessionSnapshot = options?.preserveCurrentSession
      ? captureCurrentSession({
          profileSnapshot: profile,
          accountType: 'personal',
        })
      : null;

    if (!trimmedIdentifier.includes('@')) {
      const { data, error: resolveError } = await supabase.rpc('resolve_login_email', {
        identifier: trimmedIdentifier,
      });

      if (resolveError) {
        return { error: resolveError as Error };
      }

      if (!data) {
        return { error: new Error('Invalid login credentials') };
      }

      email = data;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && previousSessionSnapshot) {
      storeSessionSnapshot(previousSessionSnapshot);
      pushSwitchStackSnapshot(previousSessionSnapshot);
    }

    return { error: error as Error | null };
  };

  const signInWithOtp = async (
    payload: { email: string; token: string; type: 'magiclink' },
    options?: SignInOptions,
  ) => {
    const previousSessionSnapshot = options?.preserveCurrentSession
      ? captureCurrentSession({
          profileSnapshot: profile,
          accountType: 'personal',
        })
      : null;

    const { error } = await supabase.auth.verifyOtp({
      email: payload.email,
      token: payload.token,
      type: payload.type,
    });

    if (!error && previousSessionSnapshot) {
      storeSessionSnapshot(previousSessionSnapshot);
      pushSwitchStackSnapshot(previousSessionSnapshot);
    }

    return { error: error as Error | null };
  };

  const switchToKnownAccount = useCallback(
    async (targetUserId: string, options?: SignInOptions) => {
      if (!targetUserId) {
        return { error: new Error('Missing target user id') };
      }

      if (session?.user?.id === targetUserId) {
        return { error: null };
      }

      const nextSnapshot = accountSessionMap[targetUserId];
      if (!nextSnapshot) {
        return { error: new Error('No stored session found for this account') };
      }

      const previousSessionSnapshot = options?.preserveCurrentSession !== false
        ? captureCurrentSession({
            profileSnapshot: profile,
            accountType: 'personal',
          })
        : null;

      const { error } = await supabase.auth.setSession({
        access_token: nextSnapshot.access_token,
        refresh_token: nextSnapshot.refresh_token,
      });

      if (error) {
        updateAccountSessionMap((current) => {
          const remaining = { ...current };
          delete remaining[targetUserId];
          return remaining;
        });
        return { error: error as Error };
      }

      if (previousSessionSnapshot) {
        storeSessionSnapshot(previousSessionSnapshot);
        pushSwitchStackSnapshot(previousSessionSnapshot);
      }

      return { error: null };
    },
    [
      accountSessionMap,
      captureCurrentSession,
      updateAccountSessionMap,
      profile,
      pushSwitchStackSnapshot,
      session?.user?.id,
      storeSessionSnapshot,
    ],
  );

  const switchBackToPreviousAccount = useCallback(async () => {
    const [nextAccount, ...remainingStack] = accountSwitchStack;
    if (!nextAccount) {
      return { error: new Error('No previous account available') };
    }

    const { error } = await supabase.auth.setSession({
      access_token: nextAccount.access_token,
      refresh_token: nextAccount.refresh_token,
    });

    if (error) {
      persistAccountSwitchStack(remainingStack);
      return { error: error as Error };
    }

    persistAccountSwitchStack(remainingStack);
    return { error: null };
  }, [accountSwitchStack, persistAccountSwitchStack]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    persistAccountSessionMap({});
    clearAccountSwitchState();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signInWithOtp,
        signOut,
        refreshProfile,
        switchBackToPreviousAccount,
        switchToKnownAccount,
        canSwitchBack,
        knownAccountSessions,
        pruneKnownAccountSessions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
