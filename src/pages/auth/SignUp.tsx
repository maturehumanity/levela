import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { detectLocalePreferences, languageOptions } from '@/lib/i18n';
import { createPhoneDraft, getPhoneCountryOptions, getPhoneCountrySummary } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Lock, User, ArrowRight, CheckCircle, Globe, Phone, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { t, language } = useLanguage();
  const detected = detectLocalePreferences();
  const countryOptions = getPhoneCountryOptions(language);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState(detected.countryCode);
  const [country, setCountry] = useState(detected.country);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(detected.languageCode);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successContactLabel, setSuccessContactLabel] = useState('');
  const [successWasPhone, setSuccessWasPhone] = useState(false);
  const phoneDraft = useMemo(() => createPhoneDraft(selectedCountryCode, phoneNumber), [phoneNumber, selectedCountryCode]);
  const selectedPhoneCountry = useMemo(
    () => getPhoneCountrySummary(selectedCountryCode, language),
    [language, selectedCountryCode],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError(t('auth.mustAcceptTerms'));
      return;
    }

    if (!dateOfBirth) {
      setError(t('auth.dateOfBirthRequired'));
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedEmail && !trimmedPhone) {
      setError(t('auth.contactMethodRequired'));
      return;
    }

    if (trimmedEmail && trimmedPhone) {
      setError(t('auth.contactMethodExclusive'));
      return;
    }

    if (trimmedPhone && !phoneDraft.e164) {
      setError(t('auth.phoneInvalid'));
      return;
    }

    setLoading(true);

    const { error } = await signUp({
      email: trimmedEmail || undefined,
      phoneNumber: trimmedPhone || undefined,
      phoneCountryCode: selectedPhoneCountry.dialCode || undefined,
      phoneE164: phoneDraft.e164 || undefined,
    }, password, {
      full_name: fullName || undefined,
      date_of_birth: dateOfBirth || undefined,
      country: country || undefined,
      country_code: selectedCountryCode || undefined,
      language_code: preferredLanguage,
      phone_country_code: selectedPhoneCountry.dialCode || undefined,
      phone_number: trimmedPhone || undefined,
      phone_e164: phoneDraft.e164 || undefined,
      terms_accepted_at: new Date().toISOString(),
      terms_version: '2026-03-28',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessContactLabel(trimmedEmail || phoneDraft.e164 || trimmedPhone);
      setSuccessWasPhone(!trimmedEmail);
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            {successWasPhone ? t('auth.accountReadyTitle') : t('auth.checkEmailTitle')}
          </h1>
          <p className="text-muted-foreground mb-6">
            {successWasPhone
              ? t('auth.accountReadyMessage', { phone: successContactLabel })
              : t('auth.checkEmailMessage', { email: successContactLabel })}
          </p>
          <Button variant="outline" onClick={() => navigate('/login')}>
            {t('auth.backToLogin')}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-sm"
        >
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.h1
              className="text-4xl font-display font-bold text-primary mb-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              {t('auth.signupTitle')}
            </motion.h1>
            <p className="text-muted-foreground">{t('auth.signupSubtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('auth.fullName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t('auth.fullNamePlaceholder')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">{t('auth.dateOfBirth')}</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              <div className="flex gap-2">
                <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-w-[122px] justify-between gap-2 px-3"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{selectedPhoneCountry.flag}</span>
                        <span className="text-sm">{selectedPhoneCountry.dialCode}</span>
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={t('auth.searchCountryCode')} />
                      <CommandList>
                        <CommandEmpty>{t('editProfile.countryNotFound')}</CommandEmpty>
                        <CommandGroup>
                          {countryOptions.map((option) => (
                            <CommandItem
                              key={option.code}
                              value={`${option.label} ${option.dialCode}`}
                              onSelect={() => {
                                setSelectedCountryCode(option.code);
                                setCountry(option.label);
                                setCountryPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedCountryCode === option.code ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <span className="mr-2">{option.flag}</span>
                              <span className="flex-1 truncate">{option.label}</span>
                              <span className="text-muted-foreground">{option.dialCode}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t('auth.phonePlaceholder')}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('auth.phoneDetected', { country: country, code: selectedPhoneCountry.dialCode })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.emailOptional')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailOptionalPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('auth.contactMethodHint')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country">{t('auth.country')}</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="country"
                    type="text"
                    value={country}
                    readOnly
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('common.countryDetected')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">{t('auth.language')}</Label>
                <Select value={preferredLanguage} onValueChange={(value) => setPreferredLanguage(value as typeof preferredLanguage)}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder={t('auth.language')} />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(Boolean(checked))}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="terms" className="text-sm font-medium leading-5 text-foreground">
                    {t('auth.acceptTermsPrefix')}{' '}
                    <Link to="/terms" className="text-primary hover:underline">
                      {t('auth.termsOfUse')}
                    </Link>
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('auth.acceptTermsDescription')}</p>
                </div>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !acceptedTerms}
            >
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('auth.signInLink')}
            </Link>
          </p>
          <p className="text-center mt-3 text-sm text-muted-foreground">
            <Link to="/download" className="text-primary hover:underline font-medium">
              {t('auth.downloadAndroid')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
