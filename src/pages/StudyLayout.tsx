import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageSecondaryNav } from '@/hooks/usePageSecondaryNav';
import { studySectionRegistry } from '@/lib/study-sections';

export type StudyLayoutOutletContext = {
  isSearchOpen: boolean;
};

export default function StudyLayout() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isStudyIndex = location.pathname === '/study' || location.pathname === '/study/';
  const isStudyRoute = location.pathname === '/study' || location.pathname === '/study/' || location.pathname.startsWith('/study/');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const activeStudySectionId = useMemo(() => {
    const match = studySectionRegistry.find((section) =>
      section.path === '/study'
        ? location.pathname === '/study' || location.pathname === '/study/'
        : location.pathname === section.path || location.pathname.startsWith(`${section.path}/`),
    );
    return match?.id ?? 'civicLearning';
  }, [location.pathname]);

  const studySecondaryNav = useMemo(
    () => ({
      defaultValue: 'civicLearning',
      items: studySectionRegistry
        .filter((section) => section.id !== 'specialists')
        .map((section) => ({
          id: section.id,
          label: t(section.labelKey),
          title: t(section.descriptionKey),
        })),
      value: activeStudySectionId,
      onChange: (sectionId: string) => {
        const section = studySectionRegistry.find((entry) => entry.id === sectionId);
        if (section) {
          navigate(section.path);
        }
      },
    }),
    [activeStudySectionId, navigate, t],
  );
  usePageSecondaryNav(studySecondaryNav);

  const handleToggleSearch = () => {
    if (!isStudyIndex) {
      setIsSearchOpen(true);
      navigate('/study');
      return;
    }

    setIsSearchOpen((current) => !current);
  };

  return (
    <AppLayout>
      <div className="space-y-4 px-4 pb-40 pt-6 md:pb-6">
        <div>
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/study"
              className="inline-flex items-center gap-2 text-2xl font-display font-bold tracking-tight text-foreground transition-colors hover:text-primary"
            >
              <BookOpen className="h-6 w-6 text-primary" />
              <span>{t('study.sections.civicLearning.label')}</span>
            </Link>
            {isStudyRoute && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                aria-label={t('common.search')}
                onClick={handleToggleSearch}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('study.layoutSubtitle')}</p>
        </div>
        <Outlet context={{ isSearchOpen }} />
      </div>
    </AppLayout>
  );
}
