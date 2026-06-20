import { ArrowRight, ExternalLink, FileText, GitBranch, Landmark, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useLanguage } from '@/contexts/LanguageContext';
import {
  onboardingSectionLeadClass,
  onboardingSectionTitleClass,
} from '@/components/public/onboarding-styles';
import {
  LEVELA_CHARTER_URL,
  LEVELA_GOVERNANCE_DOCS_URL,
  LEVELA_REPO_URL,
} from '@/lib/onboarding-links';
import { cn } from '@/lib/utils';

const systemLayers = [
  {
    titleKey: 'onboarding.systemMapIdentity',
    descriptionKey: 'onboarding.systemMapIdentityDescription',
    tone: 'from-primary/30 to-primary/5',
  },
  {
    titleKey: 'onboarding.systemMapGovernance',
    descriptionKey: 'onboarding.systemMapGovernanceDescription',
    tone: 'from-pillar-culture/40 to-pillar-culture/10',
  },
  {
    titleKey: 'onboarding.systemMapEconomy',
    descriptionKey: 'onboarding.systemMapEconomyDescription',
    tone: 'from-pillar-economy/40 to-pillar-economy/10',
  },
  {
    titleKey: 'onboarding.systemMapStewardship',
    descriptionKey: 'onboarding.systemMapStewardshipDescription',
    tone: 'from-pillar-environment/40 to-pillar-environment/10',
  },
  {
    titleKey: 'onboarding.systemMapStandards',
    descriptionKey: 'onboarding.systemMapStandardsDescription',
    tone: 'from-accent/30 to-accent/5',
  },
] as const;

const learnMoreLinks = [
  { icon: GitBranch, labelKey: 'onboarding.learnMoreRepo', href: LEVELA_REPO_URL, external: true },
  { icon: FileText, labelKey: 'onboarding.learnMoreCharter', href: LEVELA_CHARTER_URL, external: true },
  { icon: Scale, labelKey: 'onboarding.learnMoreTerms', href: '/terms', external: false },
  { icon: Landmark, labelKey: 'onboarding.learnMoreGovernanceDocs', href: LEVELA_GOVERNANCE_DOCS_URL, external: true },
] as const;

export function OnboardingSystemMap() {
  const { t } = useLanguage();

  return (
    <section className="space-y-5">
      <div className="max-w-2xl space-y-2">
        <h2 className={onboardingSectionTitleClass}>{t('onboarding.systemMapTitle')}</h2>
        <p className={onboardingSectionLeadClass}>{t('onboarding.systemMapLead')}</p>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-primary/20 bg-card/40 p-4 sm:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
          {systemLayers.map((layer, index) => (
            <div key={layer.titleKey} className="flex flex-1 items-center gap-2 md:flex-col md:gap-1">
              <div
                className={cn(
                  'w-full flex-1 rounded-2xl border border-white/5 bg-gradient-to-br px-4 py-4 text-center',
                  layer.tone,
                )}
              >
                <p className="text-sm font-semibold text-foreground">{t(layer.titleKey)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t(layer.descriptionKey)}
                </p>
              </div>
              {index < systemLayers.length - 1 ? (
                <ArrowRight
                  className="mx-auto h-4 w-4 shrink-0 rotate-90 text-primary/60 md:rotate-0"
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OnboardingLearnMore() {
  const { t } = useLanguage();

  return (
    <section className="space-y-5">
      <div className="max-w-2xl space-y-2">
        <h2 className={onboardingSectionTitleClass}>{t('onboarding.learnMoreTitle')}</h2>
        <p className={onboardingSectionLeadClass}>{t('onboarding.learnMoreLead')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {learnMoreLinks.map((link) => {
          const className =
            'flex items-center justify-between rounded-2xl border border-border/40 bg-background/30 px-4 py-3.5 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-soft';
          const content = (
            <>
              <span className="flex items-center gap-3">
                <link.icon className="h-4 w-4 text-primary" />
                {t(link.labelKey)}
              </span>
              {link.external ? (
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              )}
            </>
          );

          if (link.external) {
            return (
              <a key={link.labelKey} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
                {content}
              </a>
            );
          }

          return (
            <Link key={link.labelKey} to={link.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
