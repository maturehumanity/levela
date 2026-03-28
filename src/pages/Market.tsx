import { motion } from 'framer-motion';
import { Store } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Market() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            {t('market.title')}
          </h1>
          <p className="text-base text-muted-foreground">
            {t('market.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="border-border/70 bg-card/95 p-6 text-center shadow-sm">
            <Store className="mx-auto mb-4 h-12 w-12 text-primary/70" />
            <h2 className="text-lg font-semibold text-foreground">
              {t('market.comingSoonTitle')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('market.comingSoonDescription')}
            </p>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
