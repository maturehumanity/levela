import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
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
import { ArrowLeft, Camera, Check, ChevronsUpDown, Loader2, Save, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCountryOptions } from '@/lib/countries';
import { uploadProfileAvatar } from '@/lib/profile-avatar';

type ProfileDraft = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  country: string | null;
};

function normalizeProfileDraft(values: {
  fullName: string;
  username: string;
  bio: string;
  country: string;
}): ProfileDraft {
  return {
    full_name: values.fullName.trim() || null,
    username: values.username.trim() || null,
    bio: values.bio.trim() || null,
    country: values.country.trim() || null,
  };
}

function areDraftsEqual(a: ProfileDraft | null, b: ProfileDraft | null) {
  if (!a || !b) return false;
  return (
    a.full_name === b.full_name &&
    a.username === b.username &&
    a.bio === b.bio &&
    a.country === b.country
  );
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [saving, setSaving] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const initializedProfileIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedDraftRef = useRef<ProfileDraft | null>(null);
  const lastSaveVersionRef = useRef(0);
  const latestAttemptVersionRef = useRef(0);
  const countryOptions = getCountryOptions(language);
  const draft = useMemo(
    () => normalizeProfileDraft({ fullName, username, bio, country }),
    [bio, country, fullName, username],
  );

  useEffect(() => {
    if (!profile?.id) return;

    const profileDraft: ProfileDraft = {
      full_name: profile.full_name || null,
      username: profile.username || null,
      bio: profile.bio || null,
      country: profile.country || null,
    };

    const currentProfileId = initializedProfileIdRef.current;
    const isNewProfile = currentProfileId !== profile.id;

    if (isNewProfile || !lastSavedDraftRef.current) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setCountry(profile.country || '');
      initializedProfileIdRef.current = profile.id;
      lastSavedDraftRef.current = profileDraft;
      setAutosaveError(null);
      return;
    }

    if (areDraftsEqual(lastSavedDraftRef.current, draft)) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setCountry(profile.country || '');
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

  const handleCountrySelect = (nextCountry: string) => {
    setCountry(nextCountry);
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

        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-background shadow-elevated">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display">
                {getInitials(fullName || profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-background"
              onClick={handleAvatarUploadClick}
              disabled={uploadingAvatar}
              aria-label={t('common.changePhoto')}
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </motion.div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('editProfile.fullName')}</Label>
            <Input
              id="fullName"
              placeholder={t('editProfile.fullNamePlaceholder')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
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
              />
            </div>
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
                          onSelect={() => void handleCountrySelect(option.label)}
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
