import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAccessiblePageLinks } from '@/lib/app-pages';
import {
  isDuplicateLinkError,
  isMissingBusinessAccessRequestsTableError,
  isMissingLinkedAccountsTableError,
} from '@/lib/linked-accounts-errors';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { ArrowLeftRight, Briefcase, LogIn, Plus, RefreshCcw } from 'lucide-react';

type LinkedAccountRow = {
  id: string;
  owner_profile_id: string;
  linked_profile_id: string;
  relationship_type: string;
  owner: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    deleted_at?: string | null;
  } | null;
  linked: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    deleted_at?: string | null;
  } | null;
};

type AccountOption = {
  profileId: string;
  label: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  accountType: 'personal' | 'business' | 'linked';
};

function getInitials(name?: string | null, username?: string | null) {
  const source = name?.trim() || username?.trim() || '?';
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function slugifyUsername(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalized || 'business').slice(0, 24);
}

function normalizeBusinessName(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toBusinessUsernameCandidate(input: string) {
  return `biz_${slugifyUsername(input)}`.slice(0, 24);
}

function createEphemeralSupabaseClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function isNetworkFetchError(error: { message?: string | null; details?: string | null } | null | undefined) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('failed to fetch') || message.includes('network');
}

export function UserPageMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profile,
    knownAccountSessions,
    canSwitchBack,
    switchBackToPreviousAccount,
    switchToKnownAccount,
    pruneKnownAccountSessions,
    signIn,
    signInWithOtp,
  } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountRow[]>([]);
  const [linkedAccountsFeatureAvailable, setLinkedAccountsFeatureAvailable] = useState(true);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [linkedAccountsLoadedOnce, setLinkedAccountsLoadedOnce] = useState(false);
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const [createBusinessOpen, setCreateBusinessOpen] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPassword, setBusinessPassword] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);

  const pageLinks = useMemo(
    () =>
      [...getAccessiblePageLinks(profile?.effective_permissions || [])].sort((a, b) =>
        t(a.labelKey).localeCompare(t(b.labelKey), undefined, { sensitivity: 'base' }),
      ),
    [profile?.effective_permissions, t],
  );

  const accountSessionByProfileId = useMemo(() => {
    const map = new Map<string, typeof knownAccountSessions[number]>();
    knownAccountSessions.forEach((account) => {
      if (account.profileId) {
        map.set(account.profileId, account);
      }
    });
    return map;
  }, [knownAccountSessions]);

  const directlyLinkedProfileIds = useMemo(() => {
    if (!profile?.id) return new Set<string>();
    const ids = new Set<string>();

    linkedAccounts.forEach((row) => {
      const owner = row.owner;
      const linked = row.linked;
      if (!owner || !linked) return;
      if (owner.deleted_at || linked.deleted_at) return;

      if (row.owner_profile_id === profile.id) {
        ids.add(row.linked_profile_id);
      } else if (row.linked_profile_id === profile.id) {
        ids.add(row.owner_profile_id);
      }
    });

    return ids;
  }, [linkedAccounts, profile?.id]);

  const fallbackSwitchBackProfileId = useMemo(() => {
    if (!profile?.id) return null;

    const businessLink = linkedAccounts.find(
      (row) =>
        row.relationship_type === 'business'
        && row.linked_profile_id === profile.id
        && !row.owner?.deleted_at
        && !row.linked?.deleted_at,
    );

    return businessLink?.owner_profile_id ?? null;
  }, [linkedAccounts, profile?.id]);

  const accountOptions = useMemo<AccountOption[]>(() => {
    if (!profile?.id) return [];

    const options: AccountOption[] = [];
    const addOption = (option: AccountOption) => {
      if (!options.find((item) => item.profileId === option.profileId)) {
        options.push(option);
      }
    };

    const currentBusinessLink = linkedAccounts.find(
      (row) =>
        row.relationship_type === 'business'
        && row.linked_profile_id === profile.id
        && !row.owner?.deleted_at
        && !row.linked?.deleted_at,
    );

    addOption({
      profileId: profile.id,
      label: currentBusinessLink ? t('home.accountSwitchBusiness') : t('home.accountSwitchPersonal'),
      username: profile.username,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      accountType: currentBusinessLink ? 'business' : 'personal',
    });

    linkedAccounts.forEach((row) => {
      const owner = row.owner;
      const linked = row.linked;
      if (!owner || !linked) return;
      if (owner.deleted_at || linked.deleted_at) return;

      if (profile.id === row.owner_profile_id) {
        addOption({
          profileId: linked.id,
          label: t('home.accountSwitchBusiness'),
          username: linked.username,
          fullName: linked.full_name,
          avatarUrl: linked.avatar_url,
          accountType: 'business',
        });
      } else if (profile.id === row.linked_profile_id) {
        addOption({
          profileId: owner.id,
          label: t('home.accountSwitchPersonal'),
          username: owner.username,
          fullName: owner.full_name,
          avatarUrl: owner.avatar_url,
          accountType: 'personal',
        });
      } else {
        addOption({
          profileId: linked.id,
          label: t('home.accountSwitchLinked'),
          username: linked.username,
          fullName: linked.full_name,
          avatarUrl: linked.avatar_url,
          accountType: 'linked',
        });
      }
    });

    knownAccountSessions.forEach((session) => {
      if (!session.profileId || session.profileId === profile.id) return;
      addOption({
        profileId: session.profileId,
        label: session.accountType === 'business' ? t('home.accountSwitchBusiness') : t('home.accountSwitchLinked'),
        username: session.username,
        fullName: session.fullName,
        avatarUrl: session.avatarUrl,
        accountType: session.accountType === 'business' ? 'business' : 'linked',
      });
    });

    return options;
  }, [
    knownAccountSessions,
    linkedAccounts,
    profile?.avatar_url,
    profile?.full_name,
    profile?.id,
    profile?.username,
    t,
  ]);

  const hasBusinessLink = useMemo(
    () =>
    linkedAccounts.some(
        (row) =>
          row.relationship_type === 'business' &&
          !row.owner?.deleted_at &&
          !row.linked?.deleted_at &&
          (row.owner_profile_id === profile?.id || row.linked_profile_id === profile?.id),
      ),
    [linkedAccounts, profile?.id],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id || !open || !linkedAccountsFeatureAvailable) return;

    let active = true;
    let settled = false;
    setLinkedLoading(true);
    setLinkedAccountsLoadedOnce(false);
    setLinkedError(null);

    const timeoutId = window.setTimeout(() => {
      if (!active || settled) return;
      setLinkedLoading(false);
      setLinkedError(t('home.accountSwitchLoadFailed'));
    }, 6000);

    supabase
      .from('linked_accounts')
      .select(
        `
          id,
          owner_profile_id,
          linked_profile_id,
          relationship_type,
          owner:profiles!linked_accounts_owner_profile_id_fkey(id, full_name, username, avatar_url, deleted_at),
          linked:profiles!linked_accounts_linked_profile_id_fkey(id, full_name, username, avatar_url, deleted_at)
        `,
      )
      .then(({ data, error }) => {
        if (!active) return;
        settled = true;
        if (error) {
          if (isMissingLinkedAccountsTableError(error)) {
            setLinkedAccountsFeatureAvailable(false);
            setLinkedAccounts([]);
            setLinkedError(null);
            return;
          }
          console.error('Error loading linked accounts:', error);
          setLinkedError(t('home.accountSwitchLoadFailed'));
          setLinkedAccounts([]);
        } else {
          setLinkedAccounts((data || []) as LinkedAccountRow[]);
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (active) {
          setLinkedLoading(false);
          setLinkedAccountsLoadedOnce(true);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [linkedAccountsFeatureAvailable, open, profile?.id, t]);

  useEffect(() => {
    if (!profile?.id) return;
    if (!open) return;
    if (!linkedAccountsLoadedOnce) return;

    const validProfileIds = new Set<string>([profile.id]);
    linkedAccounts.forEach((row) => {
      if (row.owner?.id && !row.owner?.deleted_at) {
        validProfileIds.add(row.owner.id);
      }
      if (row.linked?.id && !row.linked?.deleted_at) {
        validProfileIds.add(row.linked.id);
      }
    });

    pruneKnownAccountSessions(Array.from(validProfileIds));
  }, [linkedAccounts, linkedAccountsLoadedOnce, open, profile?.id, pruneKnownAccountSessions]);

  const switchToLinkedProfile = async (targetProfileId: string) => {
    const { data, error } = await supabase.functions.invoke('linked-account-switch', {
      body: { targetProfileId },
    });

    if (error || !data?.email || !data?.token) {
      return { error: new Error(t('home.accountSwitchFailed')) };
    }

    const result = await signInWithOtp(
      {
        email: data.email,
        token: data.token,
        type: 'magiclink',
      },
      { preserveCurrentSession: true },
    );

    return result;
  };

  const handleSwitchBack = async () => {
    setSwitchingAccountId('switch-back');

    if (canSwitchBack) {
      const { error } = await switchBackToPreviousAccount();
      if (error) {
        toast.error(t('home.accountSwitchBackFailed'));
      } else {
        toast.success(t('home.accountSwitchBackSuccess'));
      }
      setSwitchingAccountId(null);
      setOpen(false);
      return;
    }

    if (fallbackSwitchBackProfileId) {
      const { error } = await switchToLinkedProfile(fallbackSwitchBackProfileId);
      if (error) {
        toast.error(t('home.accountSwitchBackFailed'));
      } else {
        toast.success(t('home.accountSwitchBackSuccess'));
      }
      setSwitchingAccountId(null);
      setOpen(false);
      return;
    }

    toast.error(t('home.accountSwitchBackFailed'));
    setSwitchingAccountId(null);
  };

  const handleSwitchAccount = async (account: AccountOption) => {
    const session = accountSessionByProfileId.get(account.profileId);
    const directLinked = directlyLinkedProfileIds.has(account.profileId);
    const switchTargetKey = session?.userId || account.profileId;
    setSwitchingAccountId(switchTargetKey);

    let error: Error | null = null;
    if (session?.userId) {
      const result = await switchToKnownAccount(session.userId);
      error = result.error;
    } else if (directLinked) {
      const result = await switchToLinkedProfile(account.profileId);
      error = result.error;
    } else {
      error = new Error(t('home.accountSwitchFailed'));
    }

    if (error) {
      toast.error(t('home.accountSwitchFailed'));
    } else {
      toast.success(t('home.accountSwitchSuccess'));
      setOpen(false);
    }
    setSwitchingAccountId(null);
  };

  const resolveProfileIdForUser = async (options: {
    userId: string;
    email: string;
    password: string;
  }) => {
    const ephemeralClient = createEphemeralSupabaseClient();
    if (!ephemeralClient) return null;

    // Try to authenticate in the isolated client to avoid clobbering the current session.
    await ephemeralClient.auth.signInWithPassword({
      email: options.email,
      password: options.password,
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data: ownProfile } = await ephemeralClient
        .from('profiles')
        .select('id')
        .eq('user_id', options.userId)
        .maybeSingle();

      if (ownProfile?.id) {
        await ephemeralClient.auth.signOut();
        return ownProfile.id;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await ephemeralClient.auth.signOut();
    return null;
  };

  const createBusinessAccountClientSide = async () => {
    const submitBusinessAccessRequest = async (targetProfileId: string) => {
      const { error: requestError } = await supabase.from('business_account_access_requests').insert({
        target_profile_id: targetProfileId,
        requester_profile_id: profile?.id,
      });

      if (!requestError) {
        return t('home.accountSwitchAccessRequestSubmitted');
      }

      if (requestError.code === '23505') {
        return t('home.accountSwitchAccessRequestPending');
      }

      if (isMissingBusinessAccessRequestsTableError(requestError)) {
        return t('home.accountSwitchBusinessExists');
      }

      console.error('Could not create business access request:', requestError);
      return t('home.accountSwitchAccessRequestFailed');
    };

    try {
      if (!profile?.id) {
        return { error: t('home.accountSwitchCreateFailed') } as const;
      }

      const normalizedEmail = businessEmail.trim().toLowerCase();
      const normalizedBusinessName = normalizeBusinessName(businessName);
      const ephemeralClient = createEphemeralSupabaseClient();
      if (!ephemeralClient) {
        return { error: t('home.accountSwitchCreateFailed') } as const;
      }

      const usernameCandidate = toBusinessUsernameCandidate(businessName);

      const { data: existingBusinessProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameCandidate)
        .maybeSingle();

      if (existingBusinessProfile?.id) {
        const { data: existingOwnerLink } = await supabase
          .from('linked_accounts')
          .select('id')
          .eq('owner_profile_id', profile.id)
          .eq('linked_profile_id', existingBusinessProfile.id)
          .eq('relationship_type', 'business')
          .maybeSingle();

        if (existingOwnerLink?.id) {
          return { error: t('home.accountSwitchAlreadyLinked') } as const;
        }

        const requestMessage = await submitBusinessAccessRequest(existingBusinessProfile.id);
        return {
          error: null,
          accessRequested: true,
          message: requestMessage,
        } as const;
      }

      const { data: signUpData, error: signUpError } = await ephemeralClient.auth.signUp({
        email: normalizedEmail,
        password: businessPassword,
        options: {
          data: {
            full_name: businessName.trim(),
            username: usernameCandidate,
          },
        },
      });

      if (signUpError && !signUpError.message.toLowerCase().includes('already')) {
        const failureMessage = isNetworkFetchError(signUpError)
          ? t('home.accountSwitchCreateFailed')
          : (signUpError.message || t('home.accountSwitchCreateFailed'));
        return { error: failureMessage } as const;
      }

      let businessUserId = signUpData.user?.id ?? null;
      if (!businessUserId) {
        const { data: fallbackSignIn, error: fallbackSignInError } = await ephemeralClient.auth.signInWithPassword({
          email: normalizedEmail,
          password: businessPassword,
        });

        if (fallbackSignInError || !fallbackSignIn.user?.id) {
          const failureMessage = isNetworkFetchError(fallbackSignInError)
            ? t('home.accountSwitchCreateFailed')
            : (fallbackSignInError?.message || t('home.accountSwitchCreateFailed'));
          return { error: failureMessage } as const;
        }

        businessUserId = fallbackSignIn.user.id;
      }

      const linkedProfileId = await resolveProfileIdForUser({
        userId: businessUserId,
        email: normalizedEmail,
        password: businessPassword,
      });

      if (!linkedProfileId) {
        return { error: t('home.accountSwitchCreateFailed') } as const;
      }

      const { error: linkError } = await supabase.from('linked_accounts').insert({
        owner_profile_id: profile.id,
        linked_profile_id: linkedProfileId,
        relationship_type: 'business',
        business_name_normalized: normalizedBusinessName,
      });

      if (linkError) {
        if (isDuplicateLinkError(linkError)) {
          const message = String(linkError.message || '').toLowerCase();
          if (message.includes('owner') || message.includes('idx_linked_accounts_owner_business_unique')) {
            return { error: t('home.accountSwitchAlreadyLinked') } as const;
          }
          return { error: t('home.accountSwitchBusinessExists') } as const;
        }
        console.warn('Could not create linked_accounts row, keeping account creation successful:', linkError);
        return { error: t('home.accountSwitchCreateFailed') } as const;
      }

      return { error: null } as const;
    } catch (error) {
      return {
        error: isNetworkFetchError(error as { message?: string; details?: string })
          ? t('home.accountSwitchCreateFailed')
          : t('home.accountSwitchCreateFailed'),
      } as const;
    }
  };

  const handleCreateBusinessAccount = async () => {
    if (!businessName.trim() || !businessEmail.trim() || !businessPassword.trim()) {
      setBusinessError(t('home.accountSwitchCreateMissing'));
      toast.error(t('home.accountSwitchCreateMissing'));
      return;
    }

    setCreatingBusiness(true);
    setBusinessError(null);

    const createResult = await createBusinessAccountClientSide();
    if (createResult.accessRequested) {
      const infoMessage = createResult.message || t('home.accountSwitchAccessRequestSubmitted');
      setBusinessError(null);
      toast.success(infoMessage);
      setCreatingBusiness(false);
      setBusinessName('');
      setBusinessEmail('');
      setBusinessPassword('');
      setCreateBusinessOpen(false);
      return;
    }

    const createError = createResult.error;
    if (createError) {
      setBusinessError(createError);
      toast.error(createError);
      setCreatingBusiness(false);
      return;
    }

    const { error: signInError } = await signIn(businessEmail.trim(), businessPassword, {
      preserveCurrentSession: true,
    });

    if (signInError) {
      const errorMessage = String(signInError.message || t('home.accountSwitchSignInFailed'));
      setBusinessError(errorMessage);
      toast.error(errorMessage);
      setCreatingBusiness(false);
      return;
    }

    toast.success(t('home.accountSwitchCreateSuccess'));
    setBusinessName('');
    setBusinessEmail('');
    setBusinessPassword('');
    setBusinessError(null);
    setCreateBusinessOpen(false);
    setCreatingBusiness(false);
    setOpen(false);
  };

  return (
    <div className="relative overflow-visible" ref={panelRef}>
      <button
        type="button"
        data-testid="user-page-menu-trigger"
        aria-label={t('home.profileMenuButton')}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full outline-none ring-offset-background transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar className="h-12 w-12 shrink-0 border-2 border-border">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(profile?.full_name, profile?.username)}
          </AvatarFallback>
        </Avatar>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="page-list"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-card/92"
          >
            <div className="p-2 pt-2 space-y-2">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t('home.accountSwitchTitle')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('home.accountSwitchSubtitle')}</p>
                  </div>
                  {(canSwitchBack || Boolean(fallbackSwitchBackProfileId)) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-2"
                      onClick={handleSwitchBack}
                      disabled={switchingAccountId === 'switch-back'}
                    >
                      {switchingAccountId === 'switch-back' ? (
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowLeftRight className="h-4 w-4" />
                      )}
                      {t('home.accountSwitchBack')}
                    </Button>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {linkedError ? (
                    <p className="text-xs text-destructive">{linkedError}</p>
                  ) : (
                    <>
                      {accountOptions.map((account) => {
                        const session = accountSessionByProfileId.get(account.profileId);
                        const isCurrent = account.profileId === profile?.id;
                        const directLinked = directlyLinkedProfileIds.has(account.profileId);
                        const canSwitch = Boolean(session?.userId || directLinked);
                        const switchTargetKey = session?.userId || account.profileId;

                        return (
                          <div
                            key={account.profileId}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-2xl border border-border/60 px-3 py-2',
                              isCurrent && 'bg-primary/10',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {account.fullName || t('common.anonymousUser')}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {account.username ? `@${account.username}` : t('home.profileMenuNoUsername')}
                              </p>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                {account.label}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCurrent ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                                  {t('home.accountSwitchCurrent')}
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => handleSwitchAccount(account)}
                                  disabled={!canSwitch || switchingAccountId === switchTargetKey}
                                >
                                  {switchingAccountId === switchTargetKey ? (
                                    <RefreshCcw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <LogIn className="h-4 w-4" />
                                  )}
                                  {t('home.accountSwitchAction')}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {linkedLoading && (
                        <p className="text-[11px] text-muted-foreground">Syncing linked accounts...</p>
                      )}
                      {accountOptions.length === 0 && !linkedLoading && (
                        <p className="text-xs text-muted-foreground">
                          {t('home.accountSwitchNoLinked')}
                        </p>
                      )}
                      {accountOptions.length > 0 &&
                        accountOptions.some(
                          (account) =>
                            account.profileId !== profile?.id
                            && !accountSessionByProfileId.has(account.profileId)
                            && !directlyLinkedProfileIds.has(account.profileId),
                        ) && (
                          <p className="text-xs text-muted-foreground">
                            {t('home.accountSwitchMissingSession')}
                          </p>
                        )}
                    </>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                    onClick={() => setCreateBusinessOpen(true)}
                    disabled={hasBusinessLink}
                  >
                    <Plus className="h-4 w-4" />
                    {t('home.accountSwitchAddBusiness')}
                  </Button>
                  {hasBusinessLink && (
                    <span className="text-[11px] text-muted-foreground">
                      {t('home.accountSwitchAlreadyLinked')}
                    </span>
                  )}
                </div>
              </div>

              {pageLinks.map((page) => {
                const Icon = page.icon;
                const isCurrent = location.pathname === page.path;

                return (
                  <button
                    key={page.path}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-accent/70',
                      isCurrent && 'bg-primary/10 text-primary hover:bg-primary/10',
                    )}
                    onClick={() => {
                      navigate(page.path);
                      setOpen(false);
                    }}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/80',
                        isCurrent && 'border-primary/20 bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{t(page.labelKey)}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                          {t('home.currentPage')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={createBusinessOpen} onOpenChange={setCreateBusinessOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t('home.accountSwitchCreateTitle')}</DialogTitle>
            <DialogDescription>{t('home.accountSwitchCreateSubtitle')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">{t('home.accountSwitchBusinessNameLabel')}</label>
              <Input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder={t('home.accountSwitchBusinessNamePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">{t('common.email')}</label>
              <Input
                type="email"
                value={businessEmail}
                onChange={(event) => setBusinessEmail(event.target.value)}
                placeholder={t('home.accountSwitchBusinessEmailPlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">{t('common.password')}</label>
              <Input
                type="password"
                value={businessPassword}
                onChange={(event) => setBusinessPassword(event.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
              />
            </div>
          </div>

          {businessError && (
            <p className="text-sm text-destructive">{businessError}</p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateBusinessOpen(false)} disabled={creatingBusiness}>
              {t('common.cancel')}
            </Button>
            <Button type="button" className="gap-2" onClick={handleCreateBusinessAccount} disabled={creatingBusiness}>
              <Briefcase className="h-4 w-4" />
              {creatingBusiness ? t('home.accountSwitchCreating') : t('home.accountSwitchCreateAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
