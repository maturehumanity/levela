import { motion } from 'framer-motion';
import { ArrowRight, Globe2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PublicPageFooter } from '@/components/public/PublicPageFooter';
import { PublicPageShell } from '@/components/public/PublicPageShell';
import { onboardingSectionTitleClass } from '@/components/public/onboarding-styles';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils';

function ProseParagraph({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-base leading-relaxed text-foreground/90 sm:text-lg', className)}>{children}</p>;
}

export default function WhyThisExists() {
  const navigate = useNavigate();
  const { t, getNode } = useLanguage();

  const openingParagraphs = (getNode('whyThisExists.openingParagraphs') as string[] | undefined) ?? [];
  const divisionParagraphs = (getNode('whyThisExists.divisionParagraphs') as string[] | undefined) ?? [];
  const whyWaitQuestions = (getNode('whyThisExists.whyWaitQuestions') as string[] | undefined) ?? [];
  const systemPrinciples = (getNode('whyThisExists.systemPrinciples') as string[] | undefined) ?? [];
  const beyondTechnologyParagraphs = (getNode('whyThisExists.beyondTechnologyParagraphs') as string[] | undefined) ?? [];

  usePageMeta({
    title: t('whyThisExists.pageTitle'),
    description: t('whyThisExists.pageDescription'),
  });

  return (
    <PublicPageShell contentClassName="px-6 pb-12 pt-2 sm:px-8">
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-3xl space-y-10 sm:space-y-12"
      >
        <header className="space-y-4 border-b border-border/40 pb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Globe2 className="h-5 w-5" />
            </div>
            <h1 className={cn(onboardingSectionTitleClass, 'text-3xl sm:text-4xl')}>{t('whyThisExists.title')}</h1>
          </div>
        </header>

        <section className="space-y-5">
          {openingParagraphs.map((paragraph) => (
            <ProseParagraph key={paragraph}>{paragraph}</ProseParagraph>
          ))}
          <blockquote className="border-l-4 border-primary/60 py-1 pl-5 sm:pl-6">
            <p className="text-lg font-semibold leading-relaxed text-foreground sm:text-xl">
              {t('whyThisExists.centralQuestion')}
            </p>
          </blockquote>
        </section>

        <section className="space-y-5">
          {divisionParagraphs.map((paragraph) => (
            <ProseParagraph key={paragraph}>{paragraph}</ProseParagraph>
          ))}
        </section>

        <section className="space-y-4 rounded-[1.75rem] border border-accent/25 bg-gradient-to-br from-accent/10 via-card/50 to-primary/5 p-5 sm:p-6">
          <p className="text-base font-semibold leading-relaxed text-accent sm:text-lg">{t('whyThisExists.whyWaitLead')}</p>
          <ul className="space-y-3">
            {whyWaitQuestions.map((question) => (
              <li key={question} className="flex gap-3 text-base leading-relaxed text-foreground/90 sm:text-lg">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <ProseParagraph className="font-medium text-foreground">{t('whyThisExists.maturityLead')}</ProseParagraph>
          <ProseParagraph>{t('whyThisExists.proposalIntro')}</ProseParagraph>
          <ProseParagraph>{t('whyThisExists.purposeLead')}</ProseParagraph>
        </section>

        <section className="rounded-[1.75rem] border border-primary/20 bg-card/40 p-5 sm:p-6">
          <ul className="space-y-4">
            {systemPrinciples.map((principle) => (
              <li key={principle} className="flex gap-3">
                <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                <ProseParagraph className="!text-base sm:!text-lg">{principle}</ProseParagraph>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          {beyondTechnologyParagraphs.map((paragraph, index) => (
            <ProseParagraph
              key={paragraph}
              className={index === beyondTechnologyParagraphs.length - 1 ? 'font-medium text-foreground' : undefined}
            >
              {paragraph}
            </ProseParagraph>
          ))}
          <p className="text-lg font-semibold leading-relaxed text-primary sm:text-xl">{t('whyThisExists.closingInvitation')}</p>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" className="h-11">
            <Link to="/onboarding">{t('whyThisExists.backToHome')}</Link>
          </Button>
          <Button onClick={() => navigate('/signup')} className="h-11 gap-2 dark:shadow-glow">
            {t('whyThisExists.joinCta')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <PublicPageFooter />
      </motion.article>
    </PublicPageShell>
  );
}
