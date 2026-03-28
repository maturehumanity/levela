import { motion } from 'framer-motion';
import { FileText, Scale, Shield } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const sectionKeys = ['purpose', 'conduct', 'lawPrinciple', 'contributions', 'enforcement'] as const;

export default function TermsOfUse() {
  const { t, getNode } = useLanguage();
  const bullets = (getNode('terms.acceptanceBullets') as string[] | undefined) || [];

  return (
    <AppLayout hideNav={false}>
      <div className="space-y-6 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{t('terms.title')}</h1>
            <p className="text-base text-muted-foreground">{t('terms.subtitle')}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <Card className="rounded-3xl border-border/70 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t('terms.acceptanceTitle')}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t('terms.acceptanceDescription')}</p>
                <ul className="mt-4 space-y-2">
                  {bullets.map((bullet, index) => (
                    <li key={index} className="flex gap-2 text-sm text-foreground/90">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          className="grid gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          {sectionKeys.map((sectionKey, index) => (
            <motion.div
              key={sectionKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.04 }}
            >
              <Card className="rounded-3xl border-border/70 bg-card/95 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {sectionKey === 'lawPrinciple' ? <Scale className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{t(`terms.sections.${sectionKey}.title`)}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t(`terms.sections.${sectionKey}.body`)}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AppLayout>
  );
}
