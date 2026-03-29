import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useMemo, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, Camera, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Eye, EyeOff, Globe, Hammer, Loader2, PencilLine, RotateCcw, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCountryOptions } from '@/lib/countries';
import { uploadProfileAvatar } from '@/lib/profile-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import {
  buildLevelaDid,
  buildLevelaLsiQrValue,
  buildWorldCitizenMrz,
  getWorldCitizenIdParts,
  getWorldCitizenStatusLabel,
  getWorldCitizenStatusPrefix,
  normalizeLevelaSocialId,
} from '@/lib/world-citizen-id';
import { QRCodeSVG } from 'qrcode.react';

type ProfileDraft = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  date_of_birth: string | null;
  country: string | null;
  country_code: string | null;
};

type LayoutOffset = { x: number; y: number };

const LAYOUT_STORAGE_PREFIX = 'levela-edit-profile-layout-v1';

const LAYOUT_REGION_LABELS = {
  wcFrontTitle: 'ID front title',
  wcFrontBadge: 'ID front badge',
  wcFrontPhoto: 'ID front photo',
  wcFrontIdRow: 'ID front ID row',
  wcFrontDob: 'ID front date of birth',
  wcFrontMemberSince: 'ID front member since',
  wcFrontFooterText: 'ID front footer text',
  wcFrontFooterArrows: 'ID front footer arrows',
  wcBackNames: 'ID back names',
  wcBackPhoto: 'ID back photo',
  wcBackIssuer: 'ID back issuer',
  wcBackExpires: 'ID back expires',
  wcBackDid: 'ID back DID',
  wcBackMrz: 'ID back MRZ',
  socialFrontTitle: 'Social front title',
  socialFrontBadge: 'Social front badge',
  socialFrontIdentifier: 'Social front identifier',
  socialFrontVerification: 'Social front verification',
  socialFrontRegistry: 'Social front registry',
  socialFrontFooter: 'Social front footer',
  socialBackTitle: 'Social back title',
  socialBackBadge: 'Social back badge',
  socialBackVerification: 'Social back verification',
  socialBackQr: 'Social back QR',
  socialBackLegacy: 'Social back legacy',
  socialBackDid: 'Social back DID',
} as const;

type LayoutRegionKey = keyof typeof LAYOUT_REGION_LABELS;

const DEFAULT_LAYOUT_OFFSETS: Record<LayoutRegionKey, LayoutOffset> = {
  wcFrontTitle: { x: 0, y: 0 },
  wcFrontBadge: { x: 0, y: 0 },
  wcFrontPhoto: { x: 0, y: 0 },
  wcFrontIdRow: { x: 0, y: 0 },
  wcFrontDob: { x: 0, y: 0 },
  wcFrontMemberSince: { x: 0, y: 0 },
  wcFrontFooterText: { x: 0, y: 0 },
  wcFrontFooterArrows: { x: 0, y: 0 },
  wcBackNames: { x: 0, y: 0 },
  wcBackPhoto: { x: 0, y: 0 },
  wcBackIssuer: { x: 0, y: 0 },
  wcBackExpires: { x: 0, y: 0 },
  wcBackDid: { x: 0, y: 0 },
  wcBackMrz: { x: 0, y: 0 },
  socialFrontTitle: { x: 0, y: 0 },
  socialFrontBadge: { x: 0, y: 0 },
  socialFrontIdentifier: { x: 0, y: 0 },
  socialFrontVerification: { x: 0, y: 0 },
  socialFrontRegistry: { x: 0, y: 0 },
  socialFrontFooter: { x: 0, y: 0 },
  socialBackTitle: { x: 0, y: 0 },
  socialBackBadge: { x: 0, y: 0 },
  socialBackVerification: { x: 0, y: 0 },
  socialBackQr: { x: 0, y: 0 },
  socialBackLegacy: { x: 0, y: 0 },
  socialBackDid: { x: 0, y: 0 },
};

function normalizeProfileDraft(values: {
  fullName: string;
  username: string;
  bio: string;
  dateOfBirth: string;
  country: string;
  countryCode: string;
}): ProfileDraft {
  return {
    full_name: values.fullName.trim() || null,
    username: values.username.trim() || null,
    bio: values.bio.trim() || null,
    date_of_birth: values.dateOfBirth || null,
    country: values.country.trim() || null,
    country_code: values.countryCode.trim() || null,
  };
}

function areDraftsEqual(a: ProfileDraft | null, b: ProfileDraft | null) {
  if (!a || !b) return false;
  return (
    a.full_name === b.full_name &&
    a.username === b.username &&
    a.bio === b.bio &&
    a.date_of_birth === b.date_of_birth &&
    a.country === b.country &&
    a.country_code === b.country_code
  );
}

function getUsernameChangeState(profile?: {
  created_at: string;
  username_last_changed_at?: string | null;
}) {
  if (!profile) {
    return { canEdit: false, key: 'editProfile.usernameChangeUnavailable', vars: {} as Record<string, string> };
  }

  const createdAt = new Date(profile.created_at);
  const now = new Date();
  const firstWindowEndsAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  if (now <= firstWindowEndsAt) {
    return {
      canEdit: true,
      key: 'editProfile.usernameChangeWindow',
      vars: { date: firstWindowEndsAt.toLocaleString() },
    };
  }

  if (!profile.username_last_changed_at) {
    return {
      canEdit: true,
      key: 'editProfile.usernameChangeAvailable',
      vars: {},
    };
  }

  const nextAvailableAt = new Date(new Date(profile.username_last_changed_at).getTime() + 365 * 24 * 60 * 60 * 1000);
  if (now >= nextAvailableAt) {
    return {
      canEdit: true,
      key: 'editProfile.usernameChangeYearlyAvailable',
      vars: {},
    };
  }

  return {
    canEdit: false,
    key: 'editProfile.usernameChangeNextDate',
    vars: { date: nextAvailableAt.toLocaleDateString() },
  };
}

function getFullNameChangeState(profile?: {
  created_at: string;
  full_name_change_count?: number | null;
}) {
  if (!profile) {
    return {
      canEdit: false,
      remaining: 0,
      deadline: null as Date | null,
      key: 'editProfile.nameChangeUnavailable',
      vars: {} as Record<string, string>,
    };
  }

  const createdAt = new Date(profile.created_at);
  const deadline = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const used = Math.max(0, profile.full_name_change_count || 0);
  const remaining = Math.max(0, 3 - used);

  if (now > deadline || remaining <= 0) {
    return {
      canEdit: false,
      remaining,
      deadline,
      key: 'editProfile.nameChangeEnded',
      vars: { date: deadline.toLocaleDateString() },
    };
  }

  return {
    canEdit: true,
    remaining,
    deadline,
    key: 'editProfile.nameChangeAvailable',
    vars: {
      count: String(remaining),
      date: deadline.toLocaleDateString(),
    },
  };
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [countryCode, setCountryCode] = useState(profile?.country_code || '');
  const [saving, setSaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [showOfficialId, setShowOfficialId] = useState(false);
  const [editingIdentityInfo, setEditingIdentityInfo] = useState(false);
  const [worldCitizenCardSide, setWorldCitizenCardSide] = useState<'front' | 'back'>('front');
  const [socialCardSide, setSocialCardSide] = useState<'front' | 'back'>('front');
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [selectedLayoutRegion, setSelectedLayoutRegion] = useState<LayoutRegionKey | null>('wcFrontFooterText');
  const [layoutOffsets, setLayoutOffsets] = useState<Record<LayoutRegionKey, LayoutOffset>>(DEFAULT_LAYOUT_OFFSETS);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const initializedProfileIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedDraftRef = useRef<ProfileDraft | null>(null);
  const lastSaveVersionRef = useRef(0);
  const latestAttemptVersionRef = useRef(0);
  const layoutStorageKey = useMemo(
    () => `${LAYOUT_STORAGE_PREFIX}:${profile?.id ?? 'anonymous'}`,
    [profile?.id],
  );
  const canUseLayoutEditor = Boolean(profile?.effective_permissions?.includes('build.use'));
  const countryOptions = getCountryOptions(language);
  const usernameChangeState = useMemo(() => getUsernameChangeState(profile), [profile]);
  const fullNameChangeState = useMemo(
    () =>
      getFullNameChangeState({
        created_at: profile?.created_at || new Date().toISOString(),
      full_name_change_count: profile?.full_name_change_count,
    }),
    [profile?.created_at, profile?.full_name_change_count],
  );
  const formattedOfficialId = useMemo(() => profile?.official_id?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null, [profile?.official_id]);
  const officialIdDisplay = useMemo(
    () => (formattedOfficialId ? getWorldCitizenIdParts(formattedOfficialId, showOfficialId) : null),
    [formattedOfficialId, showOfficialId],
  );
  const formattedLsi = useMemo(() => normalizeLevelaSocialId(profile?.social_security_number), [profile?.social_security_number]);
  const citizenStatusPrefix = useMemo(
    () => getWorldCitizenStatusPrefix(profile?.role, profile?.is_verified),
    [profile?.is_verified, profile?.role],
  );
  const mrzLines = useMemo(
    () => (formattedOfficialId ? buildWorldCitizenMrz({ officialId: formattedOfficialId, fullName: profile?.full_name, createdAt: profile?.created_at }) : []),
    [formattedOfficialId, profile?.created_at, profile?.full_name],
  );
  const didUri = useMemo(() => (formattedOfficialId ? buildLevelaDid(formattedOfficialId) : null), [formattedOfficialId]);
  const didDisplay = useMemo(() => (didUri ? didUri.replace(/^did:/, '') : null), [didUri]);
  const identityName = fullName || profile?.full_name || t('home.worldCitizen');
  const { givenName, surname } = useMemo(() => {
    const parts = identityName.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { givenName: identityName.trim() || '—', surname: '—' };
    }
    return {
      givenName: parts.slice(0, -1).join(' '),
      surname: parts[parts.length - 1],
    };
  }, [identityName]);
  const lsiQrValue = useMemo(
    () => (formattedOfficialId && formattedLsi ? buildLevelaLsiQrValue(formattedOfficialId, formattedLsi) : null),
    [formattedLsi, formattedOfficialId],
  );
  const memberSinceLabel = useMemo(() => {
    if (!profile?.created_at) return null;
    const createdAt = new Date(profile.created_at);
    if (Number.isNaN(createdAt.getTime())) return null;
    return createdAt.toLocaleDateString(language, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }, [language, profile?.created_at]);
  const dateOfBirthLabel = useMemo(() => {
    if (!dateOfBirth) return null;
    const parsed = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(language, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }, [dateOfBirth, language]);
  const expiryLabel = useMemo(() => {
    if (!profile?.created_at) return null;
    const createdAt = new Date(profile.created_at);
    if (Number.isNaN(createdAt.getTime())) return null;
    const expiryDate = new Date(createdAt);
    expiryDate.setUTCFullYear(expiryDate.getUTCFullYear() + 10);
    return expiryDate.toLocaleDateString(language, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }, [language, profile?.created_at]);
  const draft = useMemo(
    () => normalizeProfileDraft({ fullName, username, bio, dateOfBirth, country, countryCode }),
    [bio, country, countryCode, dateOfBirth, fullName, username],
  );

  useEffect(() => {
    if (!canUseLayoutEditor) {
      setLayoutEditMode(false);
      setSelectedLayoutRegion(null);
      setLayoutOffsets(DEFAULT_LAYOUT_OFFSETS);
      return;
    }

    const raw = window.localStorage.getItem(layoutStorageKey);
    if (!raw) {
      setLayoutOffsets(DEFAULT_LAYOUT_OFFSETS);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Record<LayoutRegionKey, LayoutOffset>>;
      setLayoutOffsets({
        ...DEFAULT_LAYOUT_OFFSETS,
        ...parsed,
      });
    } catch {
      setLayoutOffsets(DEFAULT_LAYOUT_OFFSETS);
    }
  }, [canUseLayoutEditor, layoutStorageKey]);

  useEffect(() => {
    if (!canUseLayoutEditor) return;
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layoutOffsets));
  }, [canUseLayoutEditor, layoutOffsets, layoutStorageKey]);

  useEffect(() => {
    if (!layoutEditMode || !selectedLayoutRegion) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 10 : 1;
      let deltaX = 0;
      let deltaY = 0;

      switch (event.key) {
        case 'ArrowUp':
          deltaY = -step;
          break;
        case 'ArrowDown':
          deltaY = step;
          break;
        case 'ArrowLeft':
          deltaX = -step;
          break;
        case 'ArrowRight':
          deltaX = step;
          break;
        default:
          return;
      }

      event.preventDefault();
      setLayoutOffsets((current) => ({
        ...current,
        [selectedLayoutRegion]: {
          x: current[selectedLayoutRegion].x + deltaX,
          y: current[selectedLayoutRegion].y + deltaY,
        },
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layoutEditMode, selectedLayoutRegion]);

  useEffect(() => {
    if (!profile?.id) return;

    const profileDraft: ProfileDraft = {
      full_name: profile.full_name || null,
      username: profile.username || null,
      bio: profile.bio || null,
      date_of_birth: profile.date_of_birth || null,
      country: profile.country || null,
      country_code: profile.country_code || null,
    };

    const currentProfileId = initializedProfileIdRef.current;
    const isNewProfile = currentProfileId !== profile.id;

    if (isNewProfile || !lastSavedDraftRef.current) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setDateOfBirth(profile.date_of_birth || '');
      setCountry(profile.country || '');
      setCountryCode(profile.country_code || '');
      initializedProfileIdRef.current = profile.id;
      lastSavedDraftRef.current = profileDraft;
      setAutosaveError(null);
      return;
    }

    if (areDraftsEqual(lastSavedDraftRef.current, draft)) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setDateOfBirth(profile.date_of_birth || '');
      setCountry(profile.country || '');
      setCountryCode(profile.country_code || '');
    }

    lastSavedDraftRef.current = profileDraft;
  }, [profile]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const persistDraft = async (nextDraft: ProfileDraft, manualRetry = false) => {
    if (!profile?.id) return;

    const version = latestAttemptVersionRef.current + 1;
    latestAttemptVersionRef.current = version;
    setSaving(true);
    setAutosaveError(null);

    const { error } = await supabase
      .from('profiles')
      .update(nextDraft)
      .eq('id', profile.id);

    if (error) {
      const nextError =
        error.code === '23505' ? t('editProfile.usernameTaken') : t('editProfile.autoSaveFailed');

      if (version === latestAttemptVersionRef.current) {
        setAutosaveError(nextError);
      }

      if (error.code === '23505') {
        toast.error(t('editProfile.usernameTaken'));
      } else {
        toast.error(t('editProfile.autoSaveFailed'));
      }

      if (version === latestAttemptVersionRef.current) {
        setSaving(false);
      }
      return;
    }

    if (version >= lastSaveVersionRef.current) {
      lastSaveVersionRef.current = version;
      lastSavedDraftRef.current = nextDraft;
    }

    if (version === latestAttemptVersionRef.current) {
      setSaving(false);
      setAutosaveError(null);
    }

    await refreshProfile();

    if (manualRetry) {
      toast.success(t('editProfile.profileUpdated'));
    }
  };

  const handleAvatarUploadClick = () => {
    avatarInputRef.current?.click();
  };

  useEffect(() => {
    if (!profile?.id || !lastSavedDraftRef.current) return;
    if (areDraftsEqual(draft, lastSavedDraftRef.current)) return;

    setAutosaveError(null);

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft(draft);
    }, 700);
  }, [draft, profile?.id]);

  const handleCountrySelect = (nextCountry: string, nextCountryCode: string) => {
    setCountry(nextCountry);
    setCountryCode(nextCountryCode);
    setCountryPickerOpen(false);
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !profile?.id || !profile.user_id) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('common.photoUploadInvalidType'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('common.photoUploadTooLarge'));
      return;
    }

    setUploadingAvatar(true);

    try {
      const { publicUrl } = await uploadProfileAvatar(file, profile.user_id);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      toast.success(t('common.photoUpdated'));
    } catch (error) {
      console.error('Error uploading profile avatar:', error);
      toast.error(t('common.photoUploadFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const nudgeLayoutRegion = (deltaX: number, deltaY: number) => {
    if (!selectedLayoutRegion) return;
    setLayoutOffsets((current) => ({
      ...current,
      [selectedLayoutRegion]: {
        x: current[selectedLayoutRegion].x + deltaX,
        y: current[selectedLayoutRegion].y + deltaY,
      },
    }));
  };

  const resetSelectedLayoutRegion = () => {
    if (!selectedLayoutRegion) return;
    setLayoutOffsets((current) => ({
      ...current,
      [selectedLayoutRegion]: DEFAULT_LAYOUT_OFFSETS[selectedLayoutRegion],
    }));
  };

  const resetAllLayoutRegions = () => {
    setLayoutOffsets(DEFAULT_LAYOUT_OFFSETS);
  };

  const renderLayoutRegion = (
    key: LayoutRegionKey,
    children: ReactNode,
    options?: {
      className?: string;
      roundedClassName?: string;
    },
  ) => {
    const offset = layoutOffsets[key];
    const isSelected = layoutEditMode && selectedLayoutRegion === key;

    return (
      <div
        className={cn('relative', options?.className)}
        data-build-key={key}
        data-build-label={LAYOUT_REGION_LABELS[key]}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {children}
        {layoutEditMode ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedLayoutRegion(key);
            }}
            className={cn(
              'absolute inset-0 z-20 cursor-pointer border border-dashed transition-colors',
              options?.roundedClassName ?? 'rounded-2xl',
              isSelected
                ? 'border-amber-300 bg-amber-300/10 shadow-[0_0_0_1px_rgba(252,211,77,0.55)]'
                : 'border-cyan-100/35 bg-cyan-50/5 hover:bg-cyan-50/8',
            )}
            aria-label={`Select ${LAYOUT_REGION_LABELS[key]}`}
          />
        ) : null}
      </div>
    );
  };

  const toggleWorldCitizenCardSide = () => {
    if (layoutEditMode) return;
    if (editingIdentityInfo) {
      setEditingIdentityInfo(false);
      return;
    }
    setWorldCitizenCardSide((current) => (current === 'front' ? 'back' : 'front'));
  };

  const toggleSocialCardSide = () => {
    if (layoutEditMode) return;
    setSocialCardSide((current) => (current === 'front' ? 'back' : 'front'));
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            {t('editProfile.title')}
          </h1>
        </motion.div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm">
            <TooltipProvider>
              <div className="mx-auto w-full max-w-[26rem]">
                <Carousel opts={{ align: 'start' }} className="w-full">
                  <CarouselContent className="-ml-0">
                    <CarouselItem className="pl-0">
                      <div
                        className="cursor-pointer"
                        style={{ aspectRatio: '1.586 / 1', perspective: '1600px' }}
                        role="button"
                        tabIndex={0}
                        aria-label={`World Citizen ID ${worldCitizenCardSide === 'front' ? 'front' : 'back'}`}
                        onClick={toggleWorldCitizenCardSide}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleWorldCitizenCardSide();
                          }
                        }}
                      >
                        <div
                          className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
                          style={{
                            transform: worldCitizenCardSide === 'front' ? 'rotateY(0deg)' : 'rotateY(180deg)',
                            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        >
                          <div
                            className="absolute inset-0 overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.22),transparent_38%),linear-gradient(160deg,#0d1d22,#16333a_56%,#10262c)] p-3.5 shadow-[0_18px_48px_rgba(4,10,12,0.28)]"
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                          >
                            <div className="flex h-full flex-col">
                              <div className="flex items-start justify-between gap-2">
                                {renderLayoutRegion(
                                  'wcFrontTitle',
                                  <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-50/85">
                                      {t('editProfile.worldCitizenId')} • {getWorldCitizenStatusLabel(profile?.role, citizenStatusPrefix, t).toUpperCase()}
                                    </p>
                                    {editingIdentityInfo ? (
                                      <Input
                                        value={fullName}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => setFullName(event.target.value)}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            event.preventDefault();
                                            setEditingIdentityInfo(false);
                                          }
                                        }}
                                        autoFocus
                                        className="mt-1 h-10 border-cyan-50/15 bg-white/10 px-0 text-[1.55rem] leading-none font-display font-semibold text-white placeholder:text-cyan-50/45 focus-visible:ring-cyan-300"
                                      />
                                    ) : (
                                      <div className="mt-1">
                                        <div className="flex items-center gap-2">
                                          <h2 className="min-w-0 truncate text-[1.6rem] leading-none font-display font-semibold text-white">
                                            {fullName || profile?.full_name || t('home.worldCitizen')}
                                          </h2>
                                          {fullNameChangeState.canEdit ? (
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setEditingIdentityInfo(true);
                                              }}
                                              className="shrink-0 rounded-full p-1 text-cyan-50/70 transition-colors hover:bg-white/8 hover:text-white"
                                              aria-label={t('editProfile.editName')}
                                            >
                                              <PencilLine className="h-3.5 w-3.5" />
                                            </button>
                                          ) : null}
                                        </div>
                                      </div>
                                    )}
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                                {renderLayoutRegion(
                                  'wcFrontBadge',
                                  <div className="rounded-2xl border border-cyan-50/15 bg-white/8 px-3 py-2 text-center">
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-50/80">WLD</p>
                                    <p className="mt-1 text-[1.7rem] leading-none font-display font-semibold text-white">{citizenStatusPrefix}</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              <div className="mt-1 grid flex-1 grid-cols-[124px,1fr] items-start gap-3">
                                {renderLayoutRegion(
                                  'wcFrontPhoto',
                                  <div className="relative self-start overflow-hidden rounded-[22px] border border-cyan-50/15 bg-black/20 shadow-inner aspect-[0.78/1] min-h-[156px]">
                                    {profile?.avatar_url ? (
                                      <img
                                        src={profile.avatar_url}
                                        alt={fullName || profile?.full_name || t('home.worldCitizen')}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full min-h-[132px] items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.22),transparent_42%),linear-gradient(160deg,#12323a,#0f2328)] text-2xl font-display text-cyan-50">
                                        {getInitials(fullName || profile?.full_name)}
                                      </div>
                                    )}
                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleAvatarUploadClick();
                                      }}
                                      disabled={uploadingAvatar}
                                      aria-label={t('common.changePhoto')}
                                      className="absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 disabled:cursor-wait group-hover:opacity-100"
                                    >
                                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-50/20 bg-black/45 text-cyan-50 shadow-lg">
                                        {uploadingAvatar ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Camera className="h-4 w-4" />
                                        )}
                                      </span>
                                    </button>
                                  </div>,
                                  { roundedClassName: 'rounded-[22px]' },
                                )}

                                <div className="flex min-h-0 flex-col">
                                  {renderLayoutRegion(
                                    'wcFrontIdRow',
                                    <div className="flex items-center justify-between gap-3 rounded-[22px] border border-cyan-50/12 bg-white/[0.06] px-4 py-2.5">
                                        <div className="min-w-0 flex flex-1 items-center gap-3">
                                          <p className="shrink-0 translate-y-px text-[12px] leading-none uppercase tracking-[0.18em] text-cyan-50/82">
                                            {t('editProfile.id')}
                                          </p>
                                          <div className="flex min-w-0 items-center gap-0.5 self-center font-mono text-[1.05rem] leading-none tracking-[0.16em]">
                                            {officialIdDisplay ? (
                                              <>
                                                <span className="truncate text-white">{officialIdDisplay.leading}</span>
                                                <span className="truncate font-semibold text-cyan-300">{officialIdDisplay.trailing}</span>
                                              </>
                                            ) : (
                                              <span className="text-white">—</span>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="grid h-9 w-9 shrink-0 place-items-center self-center rounded-full !text-cyan-50 hover:bg-white/10 hover:!text-white focus-visible:!text-white"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setShowOfficialId((current) => !current);
                                          }}
                                          aria-label={showOfficialId ? t('editProfile.hideId') : t('editProfile.showId')}
                                        >
                                          {showOfficialId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                      </div>,
                                    { roundedClassName: 'rounded-[22px]' },
                                  )}

                                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                                    {renderLayoutRegion(
                                      'wcFrontDob',
                                      <div className="rounded-[18px] border border-cyan-50/12 bg-black/18 px-3 py-2.5">
                                        <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-50/65">{t('editProfile.dateOfBirth')}</p>
                                        {editingIdentityInfo ? (
                                          <Input
                                            type="date"
                                            value={dateOfBirth}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => setDateOfBirth(event.target.value)}
                                            onBlur={() => setEditingIdentityInfo(false)}
                                            className="mt-1 h-7 border-cyan-50/15 bg-white/10 px-2 text-[11px] text-white [color-scheme:dark] focus-visible:ring-cyan-300"
                                          />
                                        ) : (
                                          <p className="mt-1 text-[12px] leading-none text-cyan-50/95">{dateOfBirthLabel || '—'}</p>
                                        )}
                                      </div>,
                                      { roundedClassName: 'rounded-[18px]' },
                                    )}
                                    {renderLayoutRegion(
                                      'wcFrontMemberSince',
                                      <div className="rounded-[18px] border border-cyan-50/12 bg-black/18 px-3 py-2.5">
                                        <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-50/65">Member Since</p>
                                        <p className="mt-1 text-[12px] leading-none text-cyan-50/95">{memberSinceLabel || '—'}</p>
                                      </div>,
                                      { roundedClassName: 'rounded-[18px]' },
                                    )}
                                  </div>

                                  <div className="relative mt-auto min-h-6 pt-3">
                                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3">
                                      {renderLayoutRegion(
                                        'wcFrontFooterText',
                                        <p
                                          className={cn(
                                            'min-w-0 flex-1 truncate text-left text-[9px] leading-none uppercase tracking-[0.14em] text-cyan-50/70 translate-y-px',
                                            fullNameChangeState.canEdit && 'animate-[pulse_3.4s_ease-in-out_infinite]',
                                          )}
                                        >
                                          {t(fullNameChangeState.key, fullNameChangeState.vars)}
                                        </p>,
                                        { className: 'min-w-0 flex-1', roundedClassName: 'rounded-md' },
                                      )}
                                      {renderLayoutRegion(
                                        'wcFrontFooterArrows',
                                        <div className="flex shrink-0 items-end justify-end gap-1 text-cyan-50/45">
                                          <ChevronLeft className="h-4 w-4" />
                                          <ChevronRight className="h-4 w-4" />
                                        </div>,
                                        { roundedClassName: 'rounded-md' },
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div
                            className="absolute inset-0 overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.18),transparent_38%),linear-gradient(160deg,#0b1720,#112730_56%,#0d1d22)] p-3.5 shadow-[0_18px_48px_rgba(4,10,12,0.28)]"
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="flex h-full flex-col">
                              <div className="flex items-start justify-between gap-3">
                                {renderLayoutRegion(
                                  'wcBackNames',
                                  <div className="min-w-0">
                                    <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.22em] text-cyan-50/85">
                                      <p>{t('editProfile.givenName')}</p>
                                      <p className="pl-2">{t('editProfile.surname')}</p>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                      <div className="min-w-0">
                                        <p className="mt-1 truncate text-[1.05rem] leading-none font-display font-semibold text-white">
                                          {givenName}
                                        </p>
                                      </div>
                                      <div className="min-w-0 pl-2">
                                        <p className="mt-1 truncate text-[1.05rem] leading-none font-display font-semibold text-white">
                                          {surname}
                                        </p>
                                      </div>
                                    </div>
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                                {renderLayoutRegion(
                                  'wcBackPhoto',
                                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-cyan-50/15 bg-white/8 shadow-inner">
                                    {profile?.avatar_url ? (
                                      <img
                                        src={profile.avatar_url}
                                        alt={identityName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.18),transparent_42%),linear-gradient(160deg,#15343c,#10242b)] text-lg font-display text-cyan-50">
                                        {getInitials(identityName)}
                                      </div>
                                    )}
                                  </div>,
                                  { roundedClassName: 'rounded-full' },
                                )}
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] leading-tight text-cyan-50">
                                {renderLayoutRegion(
                                  'wcBackIssuer',
                                  <div className="rounded-2xl border border-cyan-50/12 bg-white/[0.06] px-3 py-2">
                                    <p className="uppercase tracking-[0.16em] text-cyan-50/70">Issuer</p>
                                    <p className="mt-1 text-white">WLD / Terra</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                                {renderLayoutRegion(
                                  'wcBackExpires',
                                  <div className="rounded-2xl border border-cyan-50/12 bg-white/[0.06] px-3 py-2">
                                    <p className="uppercase tracking-[0.16em] text-cyan-50/70">Expires</p>
                                    <p className="mt-1 text-white">{expiryLabel || '—'}</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              {renderLayoutRegion(
                                'wcBackDid',
                                <div className="mt-2.5 flex items-center gap-1.5 rounded-[18px] border border-cyan-50/12 bg-white/[0.06] px-3 py-2.5">
                                  <p className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-cyan-50/80">{t('editProfile.did')}:</p>
                                  <p className="min-w-0 flex-1 truncate font-mono text-[11px] leading-none text-cyan-50/95">{didDisplay || '—'}</p>
                                </div>,
                                { roundedClassName: 'rounded-[18px]' },
                              )}

                              {renderLayoutRegion(
                                'wcBackMrz',
                                <div className="mt-auto rounded-[18px] border border-cyan-50/12 bg-black/20 px-3 py-2.5 text-cyan-50/95">
                                  <div className="space-y-0.5 leading-tight">
                                    {mrzLines.map((line) => (
                                      <div key={line} className="font-mrz text-[9.5px]">
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                </div>,
                                { roundedClassName: 'rounded-[18px]' },
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem className="pl-4">
                      <div
                        className="cursor-pointer text-sky-50"
                        style={{ aspectRatio: '1.586 / 1', perspective: '1600px' }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Social Card ${socialCardSide === 'front' ? 'front' : 'back'}`}
                        onClick={toggleSocialCardSide}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSocialCardSide();
                          }
                        }}
                      >
                        <div
                          className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
                          style={{
                            transform: socialCardSide === 'front' ? 'rotateY(0deg)' : 'rotateY(180deg)',
                            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        >
                          <div
                            className="absolute inset-0 overflow-hidden rounded-[26px] border border-sky-400/20 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.22),transparent_34%),linear-gradient(165deg,#0a1524,#12233c_52%,#0b1829)] p-3.5 text-sky-50 shadow-[0_18px_48px_rgba(4,10,20,0.28)]"
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                          >
                            <div className="flex h-full flex-col">
                              <div className="flex items-start justify-between gap-3">
                                {renderLayoutRegion(
                                  'socialFrontTitle',
                                  <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.28em] text-sky-200">
                                      {t('editProfile.socialCard')}
                                    </p>
                                    <h2 className="mt-2 text-[1.6rem] leading-none font-display font-semibold text-white">
                                      {fullName || profile?.full_name || t('home.worldCitizen')}
                                    </h2>
                                    <div className="mt-1.5 text-[13px] leading-none text-sky-50">
                                      {t('editProfile.activeWorldCitizen')}
                                    </div>
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                                {renderLayoutRegion(
                                  'socialFrontBadge',
                                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-sky-200">LSI</p>
                                    <p className="mt-1 text-base font-display font-semibold text-white">VC</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              {renderLayoutRegion(
                                'socialFrontIdentifier',
                                <div className="mt-3 flex items-start justify-between gap-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-2.5">
                                  <div className="min-w-0 flex flex-1 items-center gap-3">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <p className="shrink-0 cursor-help text-[10px] uppercase tracking-[0.2em] text-sky-200">
                                          {t('editProfile.ssn')}
                                        </p>
                                      </TooltipTrigger>
                                      <TooltipContent>{t('editProfile.socialSecurityNumber')}</TooltipContent>
                                    </Tooltip>
                                    <div className="min-w-0 truncate font-mono text-[1.06rem] leading-none tracking-[0.14em] text-white">
                                      {formattedLsi || '—'}
                                    </div>
                                  </div>
                                </div>,
                                { roundedClassName: 'rounded-[22px]' },
                              )}

                              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] leading-tight text-sky-50">
                                {renderLayoutRegion(
                                  'socialFrontVerification',
                                  <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <p className="uppercase tracking-[0.16em] text-sky-200">{t('editProfile.verification')}</p>
                                    <p className="mt-1 text-sky-50">{profile?.is_verified ? 'Verified credential' : t('editProfile.activeWorldCitizen')}</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                                {renderLayoutRegion(
                                  'socialFrontRegistry',
                                  <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <p className="uppercase tracking-[0.16em] text-sky-200">{t('editProfile.registryCode')}</p>
                                    <p className="mt-1 text-sky-50">{formattedLsi?.slice(0, 4) || 'LVLA'}</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              {renderLayoutRegion(
                                'socialFrontFooter',
                                <div className="mt-auto flex items-end justify-end gap-1 pt-3 text-sky-100/45">
                                  <ChevronLeft className="h-4 w-4" />
                                  <ChevronRight className="h-4 w-4" />
                                </div>,
                                { roundedClassName: 'rounded-xl' },
                              )}
                            </div>
                          </div>

                          <div
                            className="absolute inset-0 overflow-hidden rounded-[26px] border border-sky-400/20 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.18),transparent_34%),linear-gradient(165deg,#08111d,#102036_52%,#0a1524)] p-3.5 text-sky-50 shadow-[0_18px_48px_rgba(4,10,20,0.28)]"
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="flex h-full flex-col">
                              <div className="flex items-start justify-between gap-3">
                                {renderLayoutRegion(
                                  'socialBackTitle',
                                  <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.28em] text-sky-200">
                                      {t('editProfile.socialCard')}
                                    </p>
                                    <h2 className="mt-2 text-[1.15rem] leading-none font-display font-semibold text-white">
                                      {fullName || profile?.full_name || t('home.worldCitizen')}
                                    </h2>
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                                {renderLayoutRegion(
                                  'socialBackBadge',
                                  <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-sky-200">LSI</p>
                                    <p className="mt-1 text-base font-display font-semibold text-white">VC</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              <div className="mt-3 flex items-start justify-between gap-3 rounded-[22px] border border-white/10 bg-black/20 px-4 py-2.5">
                                {renderLayoutRegion(
                                  'socialBackVerification',
                                  <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-sky-200">{t('editProfile.verification')}</p>
                                    <p className="mt-1 text-[10px] leading-tight text-sky-50">{t('editProfile.selectiveDisclosure')}</p>
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                                {renderLayoutRegion(
                                  'socialBackQr',
                                  <div className="shrink-0 rounded-2xl bg-white p-2">
                                    {lsiQrValue ? (
                                      <QRCodeSVG value={lsiQrValue} size={60} includeMargin bgColor="#ffffff" fgColor="#0f172a" />
                                    ) : null}
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] leading-tight text-sky-50">
                                {renderLayoutRegion(
                                  'socialBackLegacy',
                                  <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <p className="uppercase tracking-[0.16em] text-sky-200">{t('editProfile.legacy')}</p>
                                    <p className="mt-1 text-sky-50">{t('editProfile.nfcReady')}</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                                {renderLayoutRegion(
                                  'socialBackDid',
                                  <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                                    <p className="uppercase tracking-[0.16em] text-sky-200">DID</p>
                                    <p className="mt-1 truncate font-mono text-sky-50">{didDisplay || '—'}</p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  </CarouselContent>
                </Carousel>

                <div className="mt-3 flex justify-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border/80" />
                </div>
              </div>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">{t('editProfile.username')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                id="username"
                placeholder={t('editProfile.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="pl-8"
                disabled={!usernameChangeState.canEdit}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t(usernameChangeState.key, usernameChangeState.vars)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">{t('editProfile.country')}</Label>
            <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 z-10 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <PopoverTrigger asChild>
                  <Button
                    id="country"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryPickerOpen}
                    className={cn(
                      'w-full justify-between pl-10 pr-3 font-normal',
                      !country && 'text-muted-foreground'
                    )}
                  >
                    <span className="truncate">{country || t('editProfile.countryPlaceholder')}</span>
                    {saving ? (
                      <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
                    ) : (
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    )}
                  </Button>
                </PopoverTrigger>
              </div>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('editProfile.searchCountryPlaceholder')} />
                  <CommandList>
                    <CommandEmpty>{t('editProfile.countryNotFound')}</CommandEmpty>
                    <CommandGroup>
                      {countryOptions.map((option) => (
                        <CommandItem
                          key={option.code}
                          value={option.label}
                            onSelect={() => void handleCountrySelect(option.label, option.code)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              country === option.label ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t('editProfile.bio')}</Label>
            <Textarea
              id="bio"
              placeholder={t('editProfile.bioPlaceholder')}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="min-h-[100px]"
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/300
            </p>
          </div>

          <div className="flex min-h-11 items-center justify-end">
            {autosaveError ? (
              <Button
                onClick={() => void persistDraft(draft, true)}
                disabled={saving}
                className="w-full gap-2"
              >
                {saving ? t('editProfile.saving') : t('editProfile.saveChanges')}
                <Save className="w-4 h-4" />
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {saving ? t('editProfile.autoSaving') : t('editProfile.autoSaveActive')}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
