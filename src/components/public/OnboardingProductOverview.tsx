import {
  BookOpen,
  Globe2,
  Heart,
  Landmark,
  Layers,
  Leaf,
  MessageCircle,
  PlusCircle,
  Scale,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { OnboardingCardHeader } from '@/components/public/OnboardingCardHeader';
import {
  onboardingSectionLeadClass,
  onboardingSectionTitleClass,
} from '@/components/public/onboarding-styles';
import { cn } from '@/lib/utils';

const productModules = [
  {
    icon: BookOpen,
    titleKey: 'onboarding.productStudyTitle',
    descriptionKey: 'onboarding.productStudyDescription',
    tone: 'bg-pillar-education text-white',
  },
  {
    icon: UserRound,
    titleKey: 'onboarding.productProfileTitle',
    descriptionKey: 'onboarding.productProfileDescription',
    tone: 'bg-pillar-culture text-white',
  },
  {
    icon: Landmark,
    titleKey: 'onboarding.productGovernanceTitle',
    descriptionKey: 'onboarding.productGovernanceDescription',
    tone: 'bg-pillar-responsibility text-white',
  },
  {
    icon: Store,
    titleKey: 'onboarding.productMarketTitle',
    descriptionKey: 'onboarding.productMarketDescription',
    tone: 'bg-pillar-economy text-white',
  },
  {
    icon: MessageCircle,
    titleKey: 'onboarding.productMessagingTitle',
    descriptionKey: 'onboarding.productMessagingDescription',
    tone: 'bg-primary/12 text-primary',
  },
  {
    icon: PlusCircle,
    titleKey: 'onboarding.productContributeTitle',
    descriptionKey: 'onboarding.productContributeDescription',
    tone: 'bg-pillar-environment text-white',
  },
] as const;

const outcomeItems = [
  { key: 'onboarding.outcomeWellbeing', icon: Heart },
  { key: 'onboarding.outcomePeace', icon: Globe2 },
  { key: 'onboarding.outcomeIntegrity', icon: ShieldCheck },
  { key: 'onboarding.outcomeFairness', icon: Scale },
  { key: 'onboarding.outcomeStewardship', icon: Leaf },
  { key: 'onboarding.outcomeStandards', icon: Layers },
] as const;

export function OnboardingOutcomes() {
  const { t } = useLanguage();

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-accent/25 bg-gradient-to-br from-accent/10 via-card/50 to-primary/5 p-5 sm:p-6">
      <div className="space-y-2">
        <h2 className={cn(onboardingSectionTitleClass, 'text-accent')}>{t('onboarding.outcomesTitle')}</h2>
        <p className={onboardingSectionLeadClass}>{t('onboarding.outcomesLead')}</p>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {outcomeItems.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-3 rounded-2xl border border-accent/15 bg-background/40 px-4 py-3 backdrop-blur-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-sm leading-relaxed text-foreground/90">{t(item.key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OnboardingProductModules() {
  const { t } = useLanguage();

  return (
    <section className="space-y-5">
      <div className="max-w-2xl space-y-2">
        <h2 className={onboardingSectionTitleClass}>{t('onboarding.productTitle')}</h2>
        <p className={onboardingSectionLeadClass}>{t('onboarding.productLead')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {productModules.map((module) => (
          <div
            key={module.titleKey}
            className="group rounded-2xl border border-border/40 bg-background/30 p-4 transition-colors hover:border-primary/20 hover:bg-card/80"
          >
            <div className="mb-2">
              <OnboardingCardHeader icon={module.icon} title={t(module.titleKey)} tone={module.tone} />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t(module.descriptionKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
