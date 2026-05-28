import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const taxonomyItems = [
  {
    icon: Store,
    labelKey: 'settings.taxonomyMarketCategories',
    descriptionKey: 'settings.taxonomyMarketCategoriesDescription',
    path: '/market/taxonomy',
  },
] as const;

export default function TaxonomySettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="flex min-h-0 flex-col px-4 pb-28 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate('/settings')}
            aria-label={t('settings.taxonomyBack')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
              {t('settings.taxonomyTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('settings.taxonomySubtitle')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {taxonomyItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="cursor-pointer p-4 transition-shadow hover:shadow-elevated"
                onClick={() => navigate(item.path)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-foreground">{t(item.labelKey)}</h2>
                    <p className="text-sm text-muted-foreground">{t(item.descriptionKey)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="mt-4 px-1 text-xs text-muted-foreground">{t('settings.taxonomyProfileHint')}</p>
      </div>
    </AppLayout>
  );
}
