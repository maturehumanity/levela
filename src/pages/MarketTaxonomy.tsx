import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { MarketCategoryList } from '@/components/market/MarketCategoryList';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MarketBrowseCategoryId } from '@/lib/market-categories';

export default function MarketTaxonomy() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSelect = (categoryId: MarketBrowseCategoryId) => {
    navigate(`/market?section=${encodeURIComponent(categoryId)}`);
  };

  return (
    <AppLayout>
      <div className="flex min-h-0 flex-col pb-28">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-3 pb-3 pt-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => navigate('/market')}
              aria-label={t('market.taxonomyBack')}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
                {t('market.taxonomyTitle')}
              </h1>
              <p className="text-xs text-muted-foreground">{t('market.taxonomySubtitle')}</p>
            </div>
          </div>
        </header>

        <div className="px-2 pt-3 sm:px-3">
          <MarketCategoryList
            activeCategoryId={null}
            onSelect={handleSelect}
            t={t}
            title={t('market.categoriesTitle')}
          />
        </div>
      </div>
    </AppLayout>
  );
}
