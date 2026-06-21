import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Compass,
  Download,
  UserPlus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { APP_VERSION } from '@/lib/app-release';
import { OnboardingCardHeader } from '@/components/public/OnboardingCardHeader';
import { onboardingSectionTitleClass } from '@/components/public/onboarding-styles';

const visitorPaths = [
  { icon: UserPlus, titleKey: 'onboarding.pathJoinTitle', descriptionKey: 'onboarding.pathJoinDescription', action: 'signup' as const },
  { icon: Compass, titleKey: 'onboarding.pathExploreTitle', descriptionKey: 'onboarding.pathExploreDescription', action: 'explore' as const },
  { icon: Download, titleKey: 'onboarding.pathTryAppTitle', descriptionKey: 'onboarding.pathTryAppDescription', action: 'download' as const },
  { icon: BookOpen, titleKey: 'onboarding.pathStudyTitle', descriptionKey: 'onboarding.pathStudyDescription', action: 'study' as const },
] as const;

const liveStatusKeys = [
  'onboarding.statusLiveStudy',
  'onboarding.statusLiveProfile',
  'onboarding.statusLiveGovernance',
  'onboarding.statusLiveMarket',
  'onboarding.statusLiveMessaging',
] as const;

const comingStatusKeys = [
  'onboarding.statusComingIos',
  'onboarding.statusComingFederation',
  'onboarding.statusComingInsurance',
] as const;

type OnboardingGetStartedHubProps = {
  onScrollToDownload: () => void;
  onScrollToLearnMore: () => void;
};

export function OnboardingGetStartedHub({
  onScrollToDownload,
  onScrollToLearnMore,
}: OnboardingGetStartedHubProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handlePathAction = (action: (typeof visitorPaths)[number]['action']) => {
    if (action === 'signup' || action === 'study') {
      navigate('/signup');
      return;
    }
    if (action === 'download') {
      onScrollToDownload();
      return;
    }
    onScrollToLearnMore();
  };

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/60 shadow-soft">
      <div className="border-b border-border/50 bg-primary/5 px-5 py-5 sm:px-6">
        <h2 className={onboardingSectionTitleClass}>{t('onboarding.pathsTitle')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visitorPaths.map((path) => (
            <button
              key={path.titleKey}
              type="button"
              onClick={() => handlePathAction(path.action)}
              className="group rounded-2xl border border-transparent bg-background/50 p-4 text-left transition-all hover:border-primary/25 hover:bg-primary/5"
            >
              <OnboardingCardHeader icon={path.icon} title={t(path.titleKey)} className="mb-2" />
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(path.descriptionKey)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-border/50 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Award className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{t('onboarding.afterJoinTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.afterJoinLead')}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          {t('onboarding.joinNetwork')}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{t('onboarding.statusTitle')}</h3>
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
            {t('onboarding.statusBadge')}
          </Badge>
          <span className="text-xs text-muted-foreground">{t('onboarding.statusVersion', { version: APP_VERSION })}</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-primary/8 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{t('onboarding.statusLiveLabel')}</p>
            <ul className="space-y-1.5">
              {liveStatusKeys.map((key) => (
                <li key={key} className="flex gap-2 text-sm text-foreground/90">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-muted/25 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('onboarding.statusComingLabel')}
            </p>
            <ul className="space-y-1.5">
              {comingStatusKeys.map((key) => (
                <li key={key} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
