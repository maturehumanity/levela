import { Link } from 'react-router-dom';

import { useLanguage } from '@/contexts/LanguageContext';

const CONTACT_URL = 'https://levela.yeremyan.net';

export function PublicPageFooter() {
  const { t } = useLanguage();

  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border/40 pt-6 text-sm text-muted-foreground">
      <Link to="/why-this-exists" className="transition-colors hover:text-foreground">
        {t('onboarding.footerWhy')}
      </Link>
      <span aria-hidden className="text-border">
        ·
      </span>
      <Link to="/terms" className="transition-colors hover:text-foreground">
        {t('onboarding.footerTerms')}
      </Link>
      <span aria-hidden className="text-border">
        ·
      </span>
      <Link to="/download" className="transition-colors hover:text-foreground">
        {t('onboarding.footerDownload')}
      </Link>
      <span aria-hidden className="text-border">
        ·
      </span>
      <a
        href={CONTACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-foreground"
      >
        {t('onboarding.footerContact')}
      </a>
    </footer>
  );
}
