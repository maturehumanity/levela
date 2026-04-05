import { motion } from 'framer-motion';
import { cloneElement, isValidElement, useState, useEffect, useRef, useMemo, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Eye, EyeOff, Globe, Loader2, PencilLine, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCountryOptions } from '@/lib/countries';
import { uploadProfileAvatar } from '@/lib/profile-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import {
  type CardCategory,
  getDefaultCardCategoryCode,
  getStoredCardCategories,
  getStoredProfileCardCategory,
  saveProfileCardCategory,
} from '@/lib/taxonomy';
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
  place_of_birth: string | null;
  sex: string | null;
  country: string | null;
  country_code: string | null;
};

const LAYOUT_REGION_LABELS = {
  editProfilePage: 'Edit Profile Page',
  editProfileBackGroup: 'Return Layer',
  editProfileBackIcon: 'Icon "Return"',
  editProfileBackText: 'Text "Back"',
  editProfileTitleGroup: 'Title Layer',
  editProfileTitle: 'Edit Profile',
  editProfileCardsGroup: 'Cards Layer',
  editProfileWorldCitizenCard: 'Layer - ID Card',
  editProfileWorldCitizenFront: 'Card Background (Front Page)',
  editProfileWorldCitizenBack: 'Card Background (Back Page)',
  editProfileSocialCard: 'Layer - Social Card',
  editProfileSocialFront: 'Social Card Background (Front Page)',
  editProfileSocialBack: 'Social Card Background (Back Page)',
  editProfileCarouselDots: 'Card Carousel Dots',
  editProfileUsernameGroup: 'Username',
  editProfileCountryGroup: 'Country',
  editProfileBioGroup: 'Bio',
  editProfileAutosaveGroup: 'Autosave Status',
  wcFrontHeaderGroup: 'World Citizen ID Header',
  wcFrontTitle: 'World Citizen ID [Role]',
  wcFrontCategoryBadge: 'Category Badge',
  wcFrontCategoryButton: 'Category',
  wcFrontCategoryLabel: 'Category Label',
  wcFrontCategoryValue: 'Category Type',
  wcFrontPhotoLayer: 'Photo Layer',
  wcFrontPhoto: 'Photo',
  wcFrontInfoCompactGroup: 'User Details Layer',
  wcFrontIdRow: 'Identity Row',
  wcFrontSurnameBlock: 'Surname',
  wcFrontSurnameLabel: 'Surname Label',
  wcFrontSurnameValue: 'Surname Value',
  wcFrontGivenNameLabel: 'Given Name Label',
  wcFrontGivenNameValue: 'Given Name Value',
  wcFrontGivenNameBlock: 'Given Name',
  wcFrontIdLineCompact: 'ID Number',
  wcFrontIdLineCompactLabel: 'ID Label',
  wcFrontIdLineCompactValue: 'ID Value',
  wcFrontIdLineCompactToggle: 'ID Visibility Toggle',
  wcFrontBirthPlaceCompact: 'Place of Birth',
  wcFrontBirthPlaceCompactLabel: 'Place of Birth Label',
  wcFrontBirthPlaceCompactValue: 'Place of Birth Value',
  wcFrontDobCompact: 'Date of Birth Card',
  wcFrontDobCompactLabel: 'Date of Birth Label',
  wcFrontDobCompactValue: 'Date of Birth Value',
  wcFrontSexCompact: 'Sex Card',
  wcFrontSexCompactLabel: 'Sex Label',
  wcFrontSexCompactValue: 'Sex Value',
  wcFrontExpiresCompact: 'Card Expires',
  wcFrontExpiresCompactLabel: 'Card Expires Label',
  wcFrontExpiresCompactValue: 'Card Expires Date',
  wcFrontMemberSinceCompact: 'Member Since',
  wcFrontMemberSinceCompactLabel: 'Member Since Label',
  wcFrontMemberSinceCompactValue: 'Member Since Date',
  wcFrontFooterLeftChevron: 'ID front footer left chevron',
  wcFrontFooterRightChevron: 'ID front footer right chevron',
  wcFrontEditWindowCompact: 'ID front edit window compact',
  wcFrontSurnameField: 'ID front surname',
  wcFrontGivenNameField: 'ID front given name',
  wcFrontBirthPlaceField: 'ID front place of birth',
  wcFrontBirthDateField: 'ID front date of birth',
  wcFrontSexField: 'ID front sex',
  wcFrontDatesBand: 'ID front dates band',
  wcFrontDob: 'ID front date of birth',
  wcFrontPlaceOfBirth: 'ID front place of birth',
  wcFrontCardExpires: 'ID front card expires',
  wcFrontMemberSinceLine: 'ID front identity meta',
  wcFrontSex: 'ID front sex',
  wcFrontEditWindow: 'ID front footer text',
  wcFrontFooterArrows: 'ID front footer arrows',
  wcBackNames: 'ID back names',
  wcBackGivenNameLabel: 'Back Given Name Label',
  wcBackGivenNameValue: 'Back Given Name Value',
  wcBackSurnameLabel: 'Back Surname Label',
  wcBackSurnameValue: 'Back Surname Value',
  wcBackIssuer: 'ID back issuer',
  wcBackIssuerLabel: 'Back Issuer Label',
  wcBackIssuerValue: 'Back Issuer Value',
  wcBackDid: 'ID back DID',
  wcBackDidLabel: 'Back DID Label',
  wcBackDidValue: 'Back DID Value',
  wcBackMrz: 'ID back MRZ',
  wcBackMrzLine1: 'Back MRZ Line 1',
  wcBackMrzLine2: 'Back MRZ Line 2',
  wcBackMrzLine3: 'Back MRZ Line 3',
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

const LEGACY_LAYOUT_STORAGE_PREFIX = 'levela-edit-profile-layout-v1';
const GLOBAL_BUILD_STORAGE_KEY = 'levela-global-build-v1';
const BUILD_STORAGE_EVENT = 'levela-build-storage-updated';

function normalizeProfileDraft(values: {
  fullName: string;
  username: string;
  bio: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: string;
  country: string;
  countryCode: string;
}): ProfileDraft {
  return {
    full_name: values.fullName.trim() || null,
    username: values.username.trim() || null,
    bio: values.bio.trim() || null,
    date_of_birth: values.dateOfBirth || null,
    place_of_birth: values.placeOfBirth.trim() || null,
    sex: values.sex.trim() || null,
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
    a.place_of_birth === b.place_of_birth &&
    a.sex === b.sex &&
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
      deadline: null as Date | null,
      key: 'editProfile.nameChangeUnavailable',
      vars: {} as Record<string, string>,
    };
  }

  const createdAt = new Date(profile.created_at);
  const deadline = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > deadline) {
    return {
      canEdit: false,
      deadline,
      key: 'editProfile.nameChangeEnded',
      vars: { date: deadline.toLocaleDateString() },
    };
  }

  return {
    canEdit: true,
    deadline,
    key: 'editProfile.nameChangeAvailable',
    vars: {
      date: deadline.toLocaleDateString(),
    },
  };
}

function isBuildModeActive() {
  return typeof document !== 'undefined' && document.body.dataset.buildModeActive === 'true';
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
  const [placeOfBirth, setPlaceOfBirth] = useState(profile?.place_of_birth || profile?.country || '');
  const [sex, setSex] = useState(profile?.sex || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [countryCode, setCountryCode] = useState(profile?.country_code || '');
  const [saving, setSaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [placeOfBirthPickerOpen, setPlaceOfBirthPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [showOfficialId, setShowOfficialId] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDateOfBirth, setEditingDateOfBirth] = useState(false);
  const [editingSex, setEditingSex] = useState(false);
  const [cardCategories, setCardCategories] = useState<CardCategory[]>(() => getStoredCardCategories());
  const [cardCategoryCode, setCardCategoryCode] = useState(getDefaultCardCategoryCode());
  const [worldCitizenCardSide, setWorldCitizenCardSide] = useState<'front' | 'back'>('front');
  const [socialCardSide, setSocialCardSide] = useState<'front' | 'back'>('front');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const worldCitizenFrontCardRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const initializedProfileIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const placeOfBirthHoverCloseRef = useRef<number | null>(null);
  const categoryHoverCloseRef = useRef<number | null>(null);
  const [categoryPopoverMetrics, setCategoryPopoverMetrics] = useState({ width: 0, alignOffset: 0 });
  const lastSavedDraftRef = useRef<ProfileDraft | null>(null);
  const lastSaveVersionRef = useRef(0);
  const latestAttemptVersionRef = useRef(0);
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
  const displayedPlaceOfBirth = placeOfBirth || country || '';
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
  const sexLabel = useMemo(() => {
    if (sex === 'M') return t('editProfile.sexMale');
    if (sex === 'F') return t('editProfile.sexFemale');
    if (sex === 'X') return t('editProfile.sexOther');
    return '—';
  }, [sex, t]);
  const selectedCardCategory = useMemo(
    () => cardCategories.find((category) => category.code === cardCategoryCode) || cardCategories[0] || { code: getDefaultCardCategoryCode(), label: t('editProfile.categoryNative') },
    [cardCategories, cardCategoryCode, t],
  );
  const draft = useMemo(
    () => normalizeProfileDraft({ fullName, username, bio, dateOfBirth, placeOfBirth, sex, country, countryCode }),
    [bio, country, countryCode, dateOfBirth, fullName, placeOfBirth, sex, username],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measureCategoryPopover = () => {
      const cardElement = worldCitizenFrontCardRef.current;
      const triggerElement = categoryTriggerRef.current;
      if (!cardElement || !triggerElement) return;

      const cardRect = cardElement.getBoundingClientRect();
      const triggerRect = triggerElement.getBoundingClientRect();

      setCategoryPopoverMetrics({
        width: cardRect.width,
        alignOffset: cardRect.left - triggerRect.left,
      });
    };

    measureCategoryPopover();

    const cardElement = worldCitizenFrontCardRef.current;
    const triggerElement = categoryTriggerRef.current;
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measureCategoryPopover();
          })
        : null;

    if (cardElement) resizeObserver?.observe(cardElement);
    if (triggerElement) resizeObserver?.observe(triggerElement);
    window.addEventListener('resize', measureCategoryPopover);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureCategoryPopover);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    const profileDraft: ProfileDraft = {
      full_name: profile.full_name || null,
      username: profile.username || null,
      bio: profile.bio || null,
      date_of_birth: profile.date_of_birth || null,
      place_of_birth: profile.place_of_birth || null,
      sex: profile.sex || null,
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
      setPlaceOfBirth(profile.place_of_birth || profile.country || '');
      setSex(profile.sex || '');
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
      setPlaceOfBirth(profile.place_of_birth || profile.country || '');
      setSex(profile.sex || '');
      setCountry(profile.country || '');
      setCountryCode(profile.country_code || '');
    }

    lastSavedDraftRef.current = profileDraft;
  }, [profile]);

  useEffect(() => {
    setCardCategories(getStoredCardCategories());
  }, []);

  useEffect(() => {
    if (!profile?.id) {
      setCardCategoryCode(getDefaultCardCategoryCode());
      return;
    }

    setCardCategoryCode(getStoredProfileCardCategory(profile.id));
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;

    const legacyKey = `${LEGACY_LAYOUT_STORAGE_PREFIX}:${profile.id}`;
    const rawLegacy = window.localStorage.getItem(legacyKey);
    if (!rawLegacy) return;

    try {
      const legacyOffsets = JSON.parse(rawLegacy) as Record<string, { x?: number; y?: number }>;
      const rawGlobal = window.localStorage.getItem(GLOBAL_BUILD_STORAGE_KEY);
      const globalStorage = rawGlobal ? JSON.parse(rawGlobal) as Record<string, Record<string, { x: number; y: number; label: string }>> : {};
      const pathname = window.location.pathname;
      const pageStorage = { ...(globalStorage[pathname] || {}) };

      Object.entries(legacyOffsets).forEach(([key, offset]) => {
        if (!(key in LAYOUT_REGION_LABELS)) return;
        const selector = `[data-build-key="${key}"]`;
        if (pageStorage[selector]) return;

        pageStorage[selector] = {
          x: Number(offset.x || 0),
          y: Number(offset.y || 0),
          label: LAYOUT_REGION_LABELS[key as keyof typeof LAYOUT_REGION_LABELS],
        };
      });

      window.localStorage.setItem(
        GLOBAL_BUILD_STORAGE_KEY,
        JSON.stringify({
          ...globalStorage,
          [pathname]: pageStorage,
        }),
      );
      window.dispatchEvent(new CustomEvent(BUILD_STORAGE_EVENT));
    } catch {
      // Ignore malformed legacy layout data.
    }
  }, [profile?.id]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      if (placeOfBirthHoverCloseRef.current !== null) {
        window.clearTimeout(placeOfBirthHoverCloseRef.current);
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
    const previousCountry = country;
    setCountry(nextCountry);
    setCountryCode(nextCountryCode);
    if (!placeOfBirth || placeOfBirth === previousCountry) {
      setPlaceOfBirth(nextCountry);
    }
    setCountryPickerOpen(false);
  };

  const openPlaceOfBirthPicker = () => {
    if (!fullNameChangeState.canEdit) return;
    if (placeOfBirthHoverCloseRef.current !== null) {
      window.clearTimeout(placeOfBirthHoverCloseRef.current);
      placeOfBirthHoverCloseRef.current = null;
    }
    setPlaceOfBirthPickerOpen(true);
  };

  const schedulePlaceOfBirthPickerClose = () => {
    if (placeOfBirthHoverCloseRef.current !== null) {
      window.clearTimeout(placeOfBirthHoverCloseRef.current);
    }
    placeOfBirthHoverCloseRef.current = window.setTimeout(() => {
      setPlaceOfBirthPickerOpen(false);
    }, 140);
  };

  const openCategoryPicker = () => {
    if (isBuildModeActive()) return;
    if (!fullNameChangeState.canEdit) return;
    if (categoryHoverCloseRef.current !== null) {
      window.clearTimeout(categoryHoverCloseRef.current);
      categoryHoverCloseRef.current = null;
    }
    setCategoryPickerOpen(true);
  };

  const scheduleCategoryPickerClose = () => {
    if (isBuildModeActive()) return;
    if (categoryHoverCloseRef.current !== null) {
      window.clearTimeout(categoryHoverCloseRef.current);
    }
    categoryHoverCloseRef.current = window.setTimeout(() => {
      setCategoryPickerOpen(false);
    }, 140);
  };

  const handleCategorySelect = (nextCode: string) => {
    if (isBuildModeActive()) return;
    const normalized = nextCode.trim().toUpperCase() || getDefaultCardCategoryCode();
    setCardCategoryCode(normalized);
    if (profile?.id) {
      saveProfileCardCategory(profile.id, normalized);
    }
    setCategoryPickerOpen(false);
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

  const renderLayoutRegion = (
    key: keyof typeof LAYOUT_REGION_LABELS,
    children: ReactNode,
    options?: {
      className?: string;
      roundedClassName?: string;
    },
  ) => {
    if (isValidElement(children) && typeof children.type === 'string') {
      const childProps = children.props as { className?: string };
      return cloneElement(children, {
        'data-build-key': key,
        'data-build-label': LAYOUT_REGION_LABELS[key],
        className: cn('relative', options?.className, childProps.className),
      });
    }

    return (
      <div
        className={cn('relative', options?.className)}
        data-build-key={key}
        data-build-label={LAYOUT_REGION_LABELS[key]}
      >
        {children}
      </div>
    );
  };

  const toggleWorldCitizenCardSide = () => {
    if (document.body.dataset.buildModeActive === 'true') return;
    if (editingName || editingDateOfBirth || editingSex) {
      setEditingName(false);
      setEditingDateOfBirth(false);
      setEditingSex(false);
      return;
    }
    setWorldCitizenCardSide((current) => (current === 'front' ? 'back' : 'front'));
  };

  const toggleSocialCardSide = () => {
    if (document.body.dataset.buildModeActive === 'true') return;
    setSocialCardSide((current) => (current === 'front' ? 'back' : 'front'));
  };

  return (
    <AppLayout>
      <div
        className="px-4 py-6 space-y-6"
        data-build-key="editProfilePage"
        data-build-label={LAYOUT_REGION_LABELS.editProfilePage}
        data-build-root="true"
      >
        <div
          className="inline-flex"
          data-build-key="editProfileBackGroup"
          data-build-label={LAYOUT_REGION_LABELS.editProfileBackGroup}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <span
              className="inline-flex"
              data-build-key="editProfileBackIcon"
              data-build-label={LAYOUT_REGION_LABELS.editProfileBackIcon}
            >
              <ArrowLeft className="w-4 h-4" />
            </span>
            <span data-build-key="editProfileBackText" data-build-label={LAYOUT_REGION_LABELS.editProfileBackText}>
              {t('common.back')}
            </span>
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          data-build-key="editProfileTitleGroup"
          data-build-label={LAYOUT_REGION_LABELS.editProfileTitleGroup}
        >
          <h1
            className="text-2xl font-display font-bold text-foreground"
            data-build-key="editProfileTitle"
            data-build-label={LAYOUT_REGION_LABELS.editProfileTitle}
          >
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
          <div
            className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm"
            data-build-key="editProfileCardsGroup"
            data-build-label={LAYOUT_REGION_LABELS.editProfileCardsGroup}
          >
            <TooltipProvider>
              <div className="mx-auto w-full max-w-[26rem]">
                <Carousel opts={{ align: 'start' }} className="w-full">
                  <CarouselContent className="-ml-0">
                    <CarouselItem className="pl-0">
                      <div
                        className="cursor-pointer"
                        style={{ aspectRatio: '1.36 / 1', perspective: '1600px' }}
                        role="button"
                        tabIndex={0}
                        data-build-key="editProfileWorldCitizenCard"
                        data-build-label={LAYOUT_REGION_LABELS.editProfileWorldCitizenCard}
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
                            className="absolute inset-0 overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.22),transparent_38%),linear-gradient(160deg,#0d1d22,#16333a_56%,#10262c)] p-3 shadow-[0_18px_48px_rgba(4,10,12,0.28)]"
                            data-build-ignore={worldCitizenCardSide !== 'front' ? 'true' : undefined}
                            data-build-key="editProfileWorldCitizenFront"
                            data-build-label={LAYOUT_REGION_LABELS.editProfileWorldCitizenFront}
                            ref={worldCitizenFrontCardRef}
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                          >
                            <div className="flex h-full flex-col">
                              <div
                                className="flex items-start justify-between gap-2"
                                data-build-key="wcFrontHeaderGroup"
                                data-build-label={LAYOUT_REGION_LABELS.wcFrontHeaderGroup}
                              >
                                {renderLayoutRegion(
                                  'wcFrontTitle',
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-50/85">
                                      {t('editProfile.worldCitizenId')} • {getWorldCitizenStatusLabel(profile?.role, citizenStatusPrefix, t).toUpperCase()}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {renderLayoutRegion(
                                        'wcFrontSurnameBlock',
                                        <div className="rounded-[16px] bg-black/8 px-2 py-1">
                                          <p
                                            className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62"
                                            data-build-key="wcFrontSurnameLabel"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontSurnameLabel}
                                          >
                                            {t('editProfile.surname')}
                                          </p>
                                          <p
                                            className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white"
                                            data-build-key="wcFrontSurnameValue"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontSurnameValue}
                                          >
                                            {surname || '—'}
                                          </p>
                                        </div>,
                                        { roundedClassName: 'rounded-[16px]' },
                                      )}

                                      {renderLayoutRegion(
                                        'wcFrontGivenNameBlock',
                                        <div className="rounded-[16px] bg-black/8 px-2 py-1">
                                          <p
                                            className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62"
                                            data-build-key="wcFrontGivenNameLabel"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontGivenNameLabel}
                                          >
                                            {t('editProfile.givenName')}
                                          </p>
                                          {editingName ? (
                                            <Input
                                              value={fullName}
                                              onClick={(event) => event.stopPropagation()}
                                              onChange={(event) => setFullName(event.target.value)}
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                  event.preventDefault();
                                                  setEditingName(false);
                                                }
                                              }}
                                              onBlur={() => setEditingName(false)}
                                              autoFocus
                                              className="mt-0.5 h-7 border-cyan-50/15 bg-white/10 px-2 text-[12px] text-white placeholder:text-cyan-50/45 focus-visible:ring-cyan-300"
                                            />
                                          ) : (
                                            <p
                                              className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white"
                                              data-build-key="wcFrontGivenNameValue"
                                              data-build-label={LAYOUT_REGION_LABELS.wcFrontGivenNameValue}
                                              onClick={(event) => {
                                                if (!fullNameChangeState.canEdit) return;
                                                event.stopPropagation();
                                                setEditingName(true);
                                              }}
                                            >
                                              {givenName || '—'}
                                            </p>
                                          )}
                                        </div>,
                                        { roundedClassName: 'rounded-[16px]' },
                                      )}
                                    </div>
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                                {renderLayoutRegion(
                                  'wcFrontCategoryBadge',
                                  <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
                                    <div
                                      className="group/category mt-[30px] shrink-0"
                                      onMouseEnter={openCategoryPicker}
                                      onMouseLeave={scheduleCategoryPickerClose}
                                    >
                                      <PopoverTrigger asChild>
                                        {renderLayoutRegion(
                                          'wcFrontCategoryButton',
                                        <button
                                          ref={categoryTriggerRef}
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (isBuildModeActive()) return;
                                            if (!fullNameChangeState.canEdit) return;
                                            setCategoryPickerOpen((current) => !current);
                                          }}
                                            className="flex h-7 min-w-[112px] items-center justify-center gap-1 rounded-full border border-cyan-50/15 bg-white/8 px-2 text-[10px] uppercase tracking-[0.12em] text-cyan-50 transition-colors hover:bg-white/12"
                                          >
                                            <span
                                              className="text-cyan-50/70"
                                              data-build-key="wcFrontCategoryLabel"
                                              data-build-label={LAYOUT_REGION_LABELS.wcFrontCategoryLabel}
                                            >
                                              {t('editProfile.categoryShort')}
                                            </span>
                                            <span
                                              className="font-display text-sm font-semibold tracking-normal text-white"
                                              data-build-key="wcFrontCategoryValue"
                                              data-build-label={LAYOUT_REGION_LABELS.wcFrontCategoryValue}
                                            >
                                              {selectedCardCategory.code}
                                            </span>
                                            {fullNameChangeState.canEdit ? <ChevronsUpDown className="h-3 w-3 text-cyan-50/70" /> : null}
                                          </button>,
                                          { roundedClassName: 'rounded-full' },
                                        )}
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="max-w-[calc(100vw-2rem)] p-0"
                                        align="start"
                                        alignOffset={categoryPopoverMetrics.alignOffset}
                                        sideOffset={4}
                                        style={categoryPopoverMetrics.width ? { width: `${categoryPopoverMetrics.width}px` } : undefined}
                                        onMouseEnter={openCategoryPicker}
                                        onMouseLeave={scheduleCategoryPickerClose}
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <Command>
                                          <CommandInput placeholder={t('editProfile.searchCategoryPlaceholder')} />
                                          <CommandList>
                                            <CommandEmpty>{t('editProfile.categoryNotFound')}</CommandEmpty>
                                            <CommandGroup className="px-0.5 py-1">
                                              {cardCategories.map((category) => (
                                                <CommandItem
                                                  key={category.code}
                                                  value={`${category.code} ${category.label}`}
                                                  onSelect={() => handleCategorySelect(category.code)}
                                                  className="grid grid-cols-[2.35rem_0.75rem_minmax(0,1fr)] items-center gap-x-0.5 px-1"
                                                >
                                                  <span className="w-full font-mono text-xs uppercase tabular-nums text-muted-foreground">
                                                    {category.code}
                                                  </span>
                                                  <Check
                                                    className={cn(
                                                      'h-4 w-4',
                                                      cardCategoryCode === category.code ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                  />
                                                  <span className="truncate">{category.label}</span>
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </div>
                                  </Popover>,
                                  { roundedClassName: 'rounded-full' },
                                )}
                              </div>

                              <div className="mt-0.5 grid flex-1 grid-cols-[94px,1fr] items-start gap-1.5">
                                <div
                                  data-build-key="wcFrontPhotoLayer"
                                  data-build-label={LAYOUT_REGION_LABELS.wcFrontPhotoLayer}
                                >
                                  {renderLayoutRegion(
                                    'wcFrontPhoto',
                                    <div className="relative self-start overflow-hidden rounded-[22px] border border-cyan-50/15 bg-black/20 shadow-inner aspect-[0.78/1] min-h-[112px]">
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
                                        data-build-ignore="true"
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
                                </div>

                                {renderLayoutRegion(
                                  'wcFrontInfoCompactGroup',
                                  <div className="relative flex min-h-0 flex-col">
                                  <div className="grid grid-cols-[1fr,0.5fr] gap-x-1.5 gap-y-0.5">
                                    {renderLayoutRegion(
                                      'wcFrontIdLineCompact',
                                      <div className="col-span-2 flex items-center justify-between gap-3 rounded-[16px] bg-white/[0.06] px-2.5 py-1">
                                        <div className="min-w-0 flex flex-1 items-center gap-2">
                                          <p
                                            className="shrink-0 text-[8px] uppercase tracking-[0.14em] text-cyan-50/62"
                                            data-build-key="wcFrontIdLineCompactLabel"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontIdLineCompactLabel}
                                          >
                                            {t('editProfile.id')}
                                          </p>
                                          <div
                                            className="flex min-w-0 items-center gap-0.5 font-mono text-[0.9rem] leading-none tracking-[0.14em]"
                                            data-build-key="wcFrontIdLineCompactValue"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontIdLineCompactValue}
                                          >
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
                                          data-build-key="wcFrontIdLineCompactToggle"
                                          data-build-label={LAYOUT_REGION_LABELS.wcFrontIdLineCompactToggle}
                                          className="grid h-7 w-7 shrink-0 place-items-center rounded-full !text-cyan-50 hover:bg-white/10 hover:!text-white focus-visible:!text-white"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (isBuildModeActive()) return;
                                            setShowOfficialId((current) => !current);
                                          }}
                                          aria-label={showOfficialId ? t('editProfile.hideId') : t('editProfile.showId')}
                                        >
                                          {showOfficialId ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </Button>
                                      </div>,
                                      { roundedClassName: 'rounded-[16px]' },
                                    )}

                                    {renderLayoutRegion(
                                      'wcFrontBirthPlaceCompact',
                                      <Popover open={placeOfBirthPickerOpen} onOpenChange={setPlaceOfBirthPickerOpen}>
                                        <div
                                          className="group/place"
                                          data-build-key="wcFrontBirthPlaceFrame"
                                          data-build-label="ID front place of birth interaction frame"
                                          onMouseEnter={openPlaceOfBirthPicker}
                                          onMouseLeave={schedulePlaceOfBirthPickerClose}
                                        >
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              data-build-key="wcFrontBirthPlaceTrigger"
                                              data-build-label="ID front place of birth trigger button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setPlaceOfBirthPickerOpen((current) => !current);
                                              }}
                                              className="flex w-full flex-col rounded-[16px] bg-black/8 px-2 py-0.75 text-left"
                                            >
                                              <p
                                                className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62"
                                                data-build-key="wcFrontBirthPlaceCompactLabel"
                                                data-build-label={LAYOUT_REGION_LABELS.wcFrontBirthPlaceCompactLabel}
                                              >
                                                {t('editProfile.placeOfBirth')}
                                              </p>
                                              <p
                                                className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white"
                                                data-build-key="wcFrontBirthPlaceCompactValue"
                                                data-build-label={LAYOUT_REGION_LABELS.wcFrontBirthPlaceCompactValue}
                                              >
                                                {displayedPlaceOfBirth || '—'}
                                              </p>
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            className="w-[220px] p-0"
                                            align="start"
                                            sideOffset={0}
                                            onMouseEnter={openPlaceOfBirthPicker}
                                            onMouseLeave={schedulePlaceOfBirthPickerClose}
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <Command>
                                              <CommandInput placeholder={t('editProfile.searchCountryPlaceholder')} />
                                              <CommandList>
                                                <CommandEmpty>{t('editProfile.countryNotFound')}</CommandEmpty>
                                                <CommandGroup>
                                                  {countryOptions.map((option) => (
                                                    <CommandItem
                                                      key={option.code}
                                                      value={option.label}
                                                      onSelect={() => {
                                                        setPlaceOfBirth(option.label);
                                                        setPlaceOfBirthPickerOpen(false);
                                                      }}
                                                    >
                                                      <Check
                                                        className={cn(
                                                          'mr-2 h-4 w-4',
                                                          displayedPlaceOfBirth === option.label ? 'opacity-100' : 'opacity-0'
                                                        )}
                                                      />
                                                      {option.label}
                                                    </CommandItem>
                                                  ))}
                                                </CommandGroup>
                                              </CommandList>
                                            </Command>
                                          </PopoverContent>
                                        </div>
                                      </Popover>,
                                      { className: 'col-span-2', roundedClassName: 'rounded-[16px]' },
                                    )}

                                    {renderLayoutRegion(
                                      'wcFrontDobCompact',
                                      <div className="group/dob rounded-[16px] bg-black/8 px-2 py-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <p
                                            className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62"
                                            data-build-key="wcFrontDobCompactLabel"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontDobCompactLabel}
                                          >
                                            {t('editProfile.dateOfBirth')}
                                          </p>
                                          {fullNameChangeState.canEdit ? (
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setEditingDateOfBirth(true);
                                              }}
                                              className="shrink-0 rounded-full p-1 text-cyan-50/70 opacity-0 transition-all duration-150 hover:bg-white/8 hover:text-white group-hover/dob:opacity-100 focus-visible:opacity-100"
                                              aria-label={t('editProfile.dateOfBirth')}
                                            >
                                              <PencilLine className="h-3.5 w-3.5" />
                                            </button>
                                          ) : null}
                                        </div>
                                        {editingDateOfBirth ? (
                                          <Input
                                            type="date"
                                            value={dateOfBirth}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => setDateOfBirth(event.target.value)}
                                            onKeyDown={(event) => {
                                              if (event.key === 'Enter') {
                                                event.preventDefault();
                                                setEditingDateOfBirth(false);
                                              }
                                            }}
                                            onBlur={() => setEditingDateOfBirth(false)}
                                            className="mt-0.5 h-7 border-cyan-50/15 bg-white/10 px-2 text-[11px] text-white [color-scheme:dark] focus-visible:ring-cyan-300"
                                          />
                                        ) : (
                                          <p
                                            className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white"
                                            data-build-key="wcFrontDobCompactValue"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontDobCompactValue}
                                          >
                                            {dateOfBirthLabel || '—'}
                                          </p>
                                        )}
                                      </div>,
                                      { roundedClassName: 'rounded-[16px]' },
                                    )}

                                    {renderLayoutRegion(
                                      'wcFrontSexCompact',
                                      <div className="group/sex rounded-[16px] bg-black/8 px-2 py-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <p
                                            className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62"
                                            data-build-key="wcFrontSexCompactLabel"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontSexCompactLabel}
                                          >
                                            {t('editProfile.sex')}
                                          </p>
                                          {!editingSex && fullNameChangeState.canEdit ? (
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setEditingSex(true);
                                              }}
                                              className="shrink-0 rounded-full p-1 text-cyan-50/70 opacity-0 transition-all duration-150 hover:bg-white/8 hover:text-white group-hover/sex:opacity-100 focus-visible:opacity-100"
                                              aria-label={t('editProfile.sex')}
                                            >
                                              <PencilLine className="h-3.5 w-3.5" />
                                            </button>
                                          ) : null}
                                        </div>
                                        {editingSex ? (
                                          <Select
                                            value={sex || '__none__'}
                                            onValueChange={(value) => {
                                              setSex(value === '__none__' ? '' : value);
                                              setEditingSex(false);
                                            }}
                                          >
                                            <SelectTrigger
                                              className="mt-0.5 h-7 min-w-[64px] border-cyan-50/15 bg-white/10 px-2 text-[12px] text-cyan-50 focus:ring-cyan-300"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent onClick={(event) => event.stopPropagation()}>
                                              <SelectItem value="M">{t('editProfile.sexMale')}</SelectItem>
                                              <SelectItem value="F">{t('editProfile.sexFemale')}</SelectItem>
                                              <SelectItem value="X">{t('editProfile.sexOther')}</SelectItem>
                                              <SelectItem value="__none__">—</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <p
                                            className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white"
                                            data-build-key="wcFrontSexCompactValue"
                                            data-build-label={LAYOUT_REGION_LABELS.wcFrontSexCompactValue}
                                          >
                                            {sexLabel}
                                          </p>
                                        )}
                                      </div>,
                                      { roundedClassName: 'rounded-[16px]' },
                                    )}

                                  </div>

                                  <div className="mt-0.5 space-y-0.5">
                                    {renderLayoutRegion(
                                      'wcFrontExpiresCompact',
                                      <div className="flex items-baseline justify-between gap-2 rounded-[16px] bg-black/8 px-2 py-0.5">
                                        <p
                                          className="shrink-0 text-[6.5px] uppercase tracking-[0.12em] text-cyan-50/62"
                                          data-build-key="wcFrontExpiresCompactLabel"
                                          data-build-label={LAYOUT_REGION_LABELS.wcFrontExpiresCompactLabel}
                                        >
                                          {t('editProfile.cardExpires')}
                                        </p>
                                        <p
                                          className="truncate text-[0.86rem] leading-none font-display font-semibold text-white"
                                          data-build-key="wcFrontExpiresCompactValue"
                                          data-build-label={LAYOUT_REGION_LABELS.wcFrontExpiresCompactValue}
                                        >
                                          {expiryLabel || '—'}
                                        </p>
                                      </div>,
                                      { roundedClassName: 'rounded-[16px]' },
                                    )}

                                    {renderLayoutRegion(
                                      'wcFrontMemberSinceCompact',
                                      <div className="flex items-baseline justify-between gap-2 rounded-[16px] bg-black/8 px-2 py-0.5">
                                        <p
                                          className="shrink-0 text-[6.5px] uppercase tracking-[0.12em] text-cyan-50/62"
                                          data-build-key="wcFrontMemberSinceCompactLabel"
                                          data-build-label={LAYOUT_REGION_LABELS.wcFrontMemberSinceCompactLabel}
                                        >
                                          {t('editProfile.memberSince')}
                                        </p>
                                        <p
                                          className="truncate text-[0.86rem] leading-none font-display font-semibold text-white"
                                          data-build-key="wcFrontMemberSinceCompactValue"
                                          data-build-label={LAYOUT_REGION_LABELS.wcFrontMemberSinceCompactValue}
                                        >
                                          {memberSinceLabel || '—'}
                                        </p>
                                      </div>,
                                      { roundedClassName: 'rounded-[16px]' },
                                    )}
                                  </div>

                                  {renderLayoutRegion(
                                    'wcFrontFooterArrows',
                                    <div className="mt-auto flex items-end justify-end gap-1 pt-3 text-cyan-50/45">
                                      <span
                                        data-build-key="wcFrontFooterLeftChevron"
                                        data-build-label={LAYOUT_REGION_LABELS.wcFrontFooterLeftChevron}
                                      >
                                        <ChevronLeft className="h-4 w-4" />
                                      </span>
                                      <span
                                        data-build-key="wcFrontFooterRightChevron"
                                        data-build-label={LAYOUT_REGION_LABELS.wcFrontFooterRightChevron}
                                      >
                                        <ChevronRight className="h-4 w-4" />
                                      </span>
                                    </div>,
                                    { roundedClassName: 'rounded-xl' },
                                  )}

                                </div>,
                                  { roundedClassName: 'rounded-[18px]' },
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="absolute inset-0 overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.18),transparent_38%),linear-gradient(160deg,#0b1720,#112730_56%,#0d1d22)] p-3.5 shadow-[0_18px_48px_rgba(4,10,12,0.28)]"
                            data-build-ignore={worldCitizenCardSide !== 'back' ? 'true' : undefined}
                            data-build-key="editProfileWorldCitizenBack"
                            data-build-label={LAYOUT_REGION_LABELS.editProfileWorldCitizenBack}
                            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="flex h-full flex-col">
                              <div className="flex items-start gap-3">
                                {renderLayoutRegion(
                                  'wcBackNames',
                                  <div className="min-w-0">
                                    <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.22em] text-cyan-50/85">
                                      <p
                                        data-build-key="wcBackGivenNameLabel"
                                        data-build-label={LAYOUT_REGION_LABELS.wcBackGivenNameLabel}
                                      >
                                        {t('editProfile.givenName')}
                                      </p>
                                      <p
                                        className="pl-2"
                                        data-build-key="wcBackSurnameLabel"
                                        data-build-label={LAYOUT_REGION_LABELS.wcBackSurnameLabel}
                                      >
                                        {t('editProfile.surname')}
                                      </p>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-3">
                                      <div className="min-w-0">
                                        <p
                                          className="mt-1 truncate text-[1.05rem] leading-none font-display font-semibold text-white"
                                          data-build-key="wcBackGivenNameValue"
                                          data-build-label={LAYOUT_REGION_LABELS.wcBackGivenNameValue}
                                        >
                                          {givenName}
                                        </p>
                                      </div>
                                      <div className="min-w-0 pl-2">
                                        <p
                                          className="mt-1 truncate text-[1.05rem] leading-none font-display font-semibold text-white"
                                          data-build-key="wcBackSurnameValue"
                                          data-build-label={LAYOUT_REGION_LABELS.wcBackSurnameValue}
                                        >
                                          {surname}
                                        </p>
                                      </div>
                                    </div>
                                  </div>,
                                  { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
                                )}
                              </div>

                              <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] leading-tight text-cyan-50">
                                {renderLayoutRegion(
                                  'wcBackIssuer',
                                  <div className="rounded-2xl border border-cyan-50/12 bg-white/[0.06] px-3 py-2">
                                    <p
                                      className="uppercase tracking-[0.16em] text-cyan-50/70"
                                      data-build-key="wcBackIssuerLabel"
                                      data-build-label={LAYOUT_REGION_LABELS.wcBackIssuerLabel}
                                    >
                                      Issuer
                                    </p>
                                    <p
                                      className="mt-1 text-white"
                                      data-build-key="wcBackIssuerValue"
                                      data-build-label={LAYOUT_REGION_LABELS.wcBackIssuerValue}
                                    >
                                      WLD / Terra
                                    </p>
                                  </div>,
                                  { roundedClassName: 'rounded-2xl' },
                                )}
                              </div>

                              {renderLayoutRegion(
                                'wcBackDid',
                                <div className="mt-2.5 flex items-center gap-1.5 rounded-[18px] border border-cyan-50/12 bg-white/[0.06] px-3 py-2.5">
                                  <p
                                    className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-cyan-50/80"
                                    data-build-key="wcBackDidLabel"
                                    data-build-label={LAYOUT_REGION_LABELS.wcBackDidLabel}
                                  >
                                    {t('editProfile.did')}:
                                  </p>
                                  <p
                                    className="min-w-0 flex-1 truncate font-mono text-[11px] leading-none text-cyan-50/95"
                                    data-build-key="wcBackDidValue"
                                    data-build-label={LAYOUT_REGION_LABELS.wcBackDidValue}
                                  >
                                    {didDisplay || '—'}
                                  </p>
                                </div>,
                                { roundedClassName: 'rounded-[18px]' },
                              )}

                              {renderLayoutRegion(
                                'wcBackMrz',
                                <div className="mt-auto rounded-[18px] border border-cyan-50/12 bg-black/20 px-3 py-2.5 text-cyan-50/95">
                                  <div className="space-y-0.5 leading-tight">
                                    {mrzLines.map((line, index) => (
                                      <div
                                        key={line}
                                        className="flex w-full items-center justify-between font-mrz text-[9.5px]"
                                        data-build-key={
                                          index === 0
                                            ? 'wcBackMrzLine1'
                                            : index === 1
                                              ? 'wcBackMrzLine2'
                                              : 'wcBackMrzLine3'
                                        }
                                        data-build-label={
                                          index === 0
                                            ? LAYOUT_REGION_LABELS.wcBackMrzLine1
                                            : index === 1
                                              ? LAYOUT_REGION_LABELS.wcBackMrzLine2
                                              : LAYOUT_REGION_LABELS.wcBackMrzLine3
                                        }
                                      >
                                        {line.split('').map((char, charIndex) => (
                                          <span key={`${line}-${charIndex}`} className="shrink-0">
                                            {char}
                                          </span>
                                        ))}
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
                        data-build-key="editProfileSocialCard"
                        data-build-label={LAYOUT_REGION_LABELS.editProfileSocialCard}
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
                            data-build-ignore={socialCardSide !== 'front' ? 'true' : undefined}
                            data-build-key="editProfileSocialFront"
                            data-build-label={LAYOUT_REGION_LABELS.editProfileSocialFront}
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
                            data-build-ignore={socialCardSide !== 'back' ? 'true' : undefined}
                            data-build-key="editProfileSocialBack"
                            data-build-label={LAYOUT_REGION_LABELS.editProfileSocialBack}
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

                <div
                  className="mt-3 flex justify-center gap-2"
                  data-build-key="editProfileCarouselDots"
                  data-build-label={LAYOUT_REGION_LABELS.editProfileCarouselDots}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-border/80" />
                </div>
              </div>
            </TooltipProvider>
          </div>

          <div
            className="space-y-2"
            data-build-key="editProfileUsernameGroup"
            data-build-label={LAYOUT_REGION_LABELS.editProfileUsernameGroup}
          >
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

          <div
            className="space-y-2"
            data-build-key="editProfileCountryGroup"
            data-build-label={LAYOUT_REGION_LABELS.editProfileCountryGroup}
          >
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

          <div
            className="space-y-2"
            data-build-key="editProfileBioGroup"
            data-build-label={LAYOUT_REGION_LABELS.editProfileBioGroup}
          >
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

          <div
            className="flex min-h-11 items-center justify-end"
            data-build-key="editProfileAutosaveGroup"
            data-build-label={LAYOUT_REGION_LABELS.editProfileAutosaveGroup}
          >
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
