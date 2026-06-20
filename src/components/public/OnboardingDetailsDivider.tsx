import { useLanguage } from '@/contexts/LanguageContext';

export function OnboardingDetailsDivider() {
  const { t } = useLanguage();

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 py-10 sm:py-12">
      <div
        aria-hidden
        className="absolute inset-0 border-y border-border/60 bg-gradient-to-r from-transparent via-muted/40 to-transparent"
      />
      <div className="relative flex items-center justify-center gap-4 px-6">
        <span className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-primary/40" aria-hidden />
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary/80 sm:text-sm">
          {t('onboarding.detailsLabel')}
        </p>
        <span className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-primary/40" aria-hidden />
      </div>
    </div>
  );
}
