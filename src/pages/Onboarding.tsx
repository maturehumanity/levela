import { type ReactNode, type RefObject, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  GitBranch,
  Globe2,
  Lock,
  ShieldAlert,
  Umbrella,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppDownloadCard } from '@/components/download/AppDownloadCard';
import { OnboardingDetailsDivider } from '@/components/public/OnboardingDetailsDivider';
import { OnboardingGetStartedHub } from '@/components/public/OnboardingGetStartedHub';
import { OnboardingHero } from '@/components/public/OnboardingHero';
import { OnboardingOutcomes, OnboardingProductModules } from '@/components/public/OnboardingProductOverview';
import { OnboardingLearnMore, OnboardingSystemMap } from '@/components/public/OnboardingSystemAndTrust';
import { OnboardingFaq } from '@/components/public/OnboardingVisitorFaq';
import { PublicPageToolbar } from '@/components/public/PublicPageToolbar';
import { PublicPageFooter } from '@/components/public/PublicPageFooter';
import { OnboardingCardHeader } from '@/components/public/OnboardingCardHeader';
import {
  onboardingContainerClass,
  onboardingSectionLeadClass,
  onboardingSectionTitleClass,
} from '@/components/public/onboarding-styles';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils';

const harmGroups = [
  {
    titleKey: 'onboarding.harmGroupConflict',
    evilKeys: ['onboarding.evilWar', 'onboarding.evilRivalry', 'onboarding.evilDivision'],
  },
  {
    titleKey: 'onboarding.harmGroupIntegrity',
    evilKeys: [
      'onboarding.evilFraud',
      'onboarding.evilImpersonation',
      'onboarding.evilLies',
      'onboarding.evilIrresponsibility',
    ],
  },
  {
    titleKey: 'onboarding.harmGroupJustice',
    evilKeys: ['onboarding.evilPoverty', 'onboarding.evilUnfairness', 'onboarding.evilDoubleStandards'],
  },
] as const;

const approachPillars = [
  {
    icon: GitBranch,
    titleKey: 'onboarding.pillarUnifiedTitle',
    descriptionKey: 'onboarding.pillarUnifiedDescription',
    exampleKey: 'onboarding.pillarUnifiedExample',
    tone: 'bg-primary/12 text-primary',
  },
  {
    icon: Globe2,
    titleKey: 'onboarding.pillarCitizenshipTitle',
    descriptionKey: 'onboarding.pillarCitizenshipDescription',
    exampleKey: 'onboarding.pillarCitizenshipExample',
    tone: 'bg-pillar-education text-white',
  },
  {
    icon: Umbrella,
    titleKey: 'onboarding.pillarInsuranceTitle',
    descriptionKey: 'onboarding.pillarInsuranceDescription',
    exampleKey: 'onboarding.pillarInsuranceExample',
    tone: 'bg-pillar-environment text-white',
  },
  {
    icon: Lock,
    titleKey: 'onboarding.pillarPrivacyTitle',
    descriptionKey: 'onboarding.pillarPrivacyDescription',
    exampleKey: 'onboarding.pillarPrivacyExample',
    tone: 'bg-accent text-accent-foreground',
  },
] as const;

type MotionSectionProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  reducedMotion: boolean | null;
  sectionRef?: RefObject<HTMLElement | null>;
  id?: string;
};

function MotionSection({
  children,
  className,
  delay = 0,
  reducedMotion,
  sectionRef,
  id,
}: MotionSectionProps) {
  if (reducedMotion) {
    return (
      <section ref={sectionRef} id={id} className={className}>
        {children}
      </section>
    );
  }

  return (
    <motion.section
      ref={sectionRef}
      id={id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();
  const downloadSectionRef = useRef<HTMLElement | null>(null);
  const learnMoreSectionRef = useRef<HTMLElement | null>(null);

  usePageMeta({
    title: t('onboarding.pageTitle'),
    description: t('onboarding.pageDescription'),
  });

  const scrollToDownload = () => {
    downloadSectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const scrollToLearnMore = () => {
    learnMoreSectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="relative min-h-screen bg-background safe-top">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-primary/8 via-primary/5 to-transparent dark:from-primary/14 dark:via-primary/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-32 h-72 w-[36rem] max-w-[120vw] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl dark:bg-primary/10"
      />

      <div className="relative mx-auto flex w-full max-w-3xl items-center justify-end px-6 pt-4 sm:px-8">
        <PublicPageToolbar />
      </div>

      <div className="relative px-6 py-6 pb-28 sm:px-8 sm:pb-12">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className={onboardingContainerClass}
        >
          <OnboardingHero reducedMotion={reducedMotion} />

          <MotionSection reducedMotion={reducedMotion} delay={0.1}>
            <div className="border-l-4 border-primary/60 py-1 pl-5 sm:pl-6">
              <h2 className={onboardingSectionTitleClass}>{t('onboarding.missionTitle')}</h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/90 sm:text-lg">
                {t('onboarding.missionLead')}
              </p>
            </div>
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.14}>
            <OnboardingOutcomes />
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.18} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-destructive/80">
              {t('onboarding.evilsTitle')}
            </h2>
            <div className="rounded-[1.75rem] border border-destructive/15 bg-destructive/5 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {harmGroups.map((group) => (
                  <div key={group.titleKey}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive/70">
                      {t(group.titleKey)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.evilKeys.map((key) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className="rounded-full border-destructive/20 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {t(key)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.24} className="space-y-5">
            <div className="max-w-2xl space-y-2">
              <h2 className={onboardingSectionTitleClass}>{t('onboarding.approachTitle')}</h2>
              <p className={onboardingSectionLeadClass}>{t('onboarding.approachLead')}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {approachPillars.map((pillar, index) => (
                <motion.div
                  key={pillar.titleKey}
                  initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 + index * 0.05 }}
                  className="rounded-[1.75rem] border border-border/40 bg-gradient-to-br from-card/80 to-background/20 p-5 shadow-soft"
                >
                  <div className="mb-3">
                    <OnboardingCardHeader
                      icon={pillar.icon}
                      title={t(pillar.titleKey)}
                      tone={pillar.tone}
                      size="md"
                    />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(pillar.descriptionKey)}</p>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-primary/90">{t(pillar.exampleKey)}</p>
                </motion.div>
              ))}
            </div>
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.32}>
            <OnboardingProductModules />
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.36}>
            <OnboardingSystemMap />
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.4}>
            <div className="flex items-center gap-4 rounded-[1.75rem] border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 sm:px-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                <ShieldAlert className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-primary sm:text-base">{t('onboarding.trustLine')}</p>
            </div>
          </MotionSection>

          <OnboardingDetailsDivider />

          <MotionSection reducedMotion={reducedMotion} delay={0.44}>
            <OnboardingGetStartedHub
              onScrollToDownload={scrollToDownload}
              onScrollToLearnMore={scrollToLearnMore}
            />
          </MotionSection>

          <MotionSection
            reducedMotion={reducedMotion}
            delay={0.46}
            sectionRef={downloadSectionRef}
            id="download-section"
            className="space-y-4 scroll-mt-8"
          >
            <div className="space-y-2">
              <h2 className={onboardingSectionTitleClass}>{t('onboarding.tryAndroidBuild')}</h2>
              <p className={onboardingSectionLeadClass}>{t('onboarding.tryAndroidBuildDescription')}</p>
            </div>
            <AppDownloadCard variant="stacked" showTestingBadge />
          </MotionSection>

          <MotionSection
            reducedMotion={reducedMotion}
            delay={0.48}
            sectionRef={learnMoreSectionRef}
            className="scroll-mt-8"
          >
            <OnboardingLearnMore />
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.5}>
            <OnboardingFaq />
          </MotionSection>

          <MotionSection reducedMotion={reducedMotion} delay={0.52} className="hidden space-y-3 sm:block">
            <Button onClick={() => navigate('/signup')} className="h-12 w-full gap-2 text-base shadow-glow" size="lg">
              {t('onboarding.joinNetwork')}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/login')} variant="outline" className="h-12 w-full text-base" size="lg">
              {t('onboarding.existingAccount')}
            </Button>
          </MotionSection>

          <PublicPageFooter />
        </motion.div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <Button onClick={() => navigate('/signup')} className="h-12 flex-1 gap-2 dark:shadow-glow" size="lg">
            {t('onboarding.joinNetwork')}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate('/login')} variant="outline" className="h-12" size="lg">
            {t('onboarding.signIn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
