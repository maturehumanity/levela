import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supportsLastActiveRef = useRef(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    const typedProfile = data as Omit<Profile, 'effective_permissions'>;

    const { data: effectivePermissionRows, error: effectivePermissionsError } = await supabase.rpc(
      'current_app_permissions',
    );

    if (effectivePermissionsError) {
      console.error('Error fetching effective permissions:', effectivePermissionsError);
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

    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      if (error.message?.toLowerCase().includes('last_active_at')) {
        supportsLastActiveRef.current = false;
        return;
      }
      console.error('Error updating last active timestamp:', error);
    }
  }, []);

  const refreshProfileForUser = useCallback(async (userId: string) => {
    const profileData = await fetchProfile(userId);
    if (profileData) {
      setProfile(profileData);
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
          // Use setTimeout to avoid potential race conditions
          setTimeout(async () => {
            await refreshProfileForUser(currentSession.user.id);
            setLoading(false);
          }, 0);
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
        refreshProfileForUser(currentSession.user.id).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshProfileForUser]);

  useEffect(() => {
    if (!user) return;

    void touchProfileActivity(user.id);

    const interval = window.setInterval(() => {
      void touchProfileActivity(user.id);
    }, 2 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void touchProfileActivity(user.id);
        void refreshProfileForUser(user.id);
      }
    };

    const handleFocus = () => {
      void touchProfileActivity(user.id);
      void refreshProfileForUser(user.id);
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
          void refreshProfileForUser(user.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [refreshProfileForUser, user?.id]);

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

  const signIn = async (identifier: string, password: string) => {
    const trimmedIdentifier = identifier.trim();
    let email = trimmedIdentifier;

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

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
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
        signOut,
        refreshProfile,
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
