import { useLanguage } from '@/contexts/LanguageContext';

type PublicAuthHeaderProps = {
  title: string;
  subtitle: string;
};

export function PublicAuthHeader({ title, subtitle }: PublicAuthHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="mb-8 text-center">
      <div className="mb-3 inline-flex items-center gap-3">
        <img
          src="/brand/levela-icon-full.svg"
          alt=""
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-xl"
        />
        <div className="text-left">
          <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-sm font-medium text-primary">{t('onboarding.slogan')}</p>
        </div>
      </div>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}
