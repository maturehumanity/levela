import { ChevronRight } from 'lucide-react';

import { MarketCategoryIcon } from '@/components/market/MarketCategoryIcon';
import {
  MARKET_BROWSE_CATEGORY_IDS,
  MARKET_CATEGORY_ICONS,
  marketCategoryLabelKey,
  type MarketBrowseCategoryId,
} from '@/lib/market-categories';
import { cn } from '@/lib/utils';

type MarketCategoryListProps = {
  activeCategoryId: MarketBrowseCategoryId | null;
  onSelect: (categoryId: MarketBrowseCategoryId) => void;
  t: (key: string) => string;
  title: string;
  className?: string;
};

export function MarketCategoryList({
  activeCategoryId,
  onSelect,
  t,
  title,
  className,
}: MarketCategoryListProps) {
  return (
    <section className={cn('rounded-xl border border-border/60 bg-card/95 shadow-sm', className)}>
      <h2 className="border-b border-border/50 px-4 py-3 text-sm font-semibold text-foreground">{title}</h2>
      <ul className="divide-y divide-border/50">
        {MARKET_BROWSE_CATEGORY_IDS.map((categoryId) => {
          const Icon = MARKET_CATEGORY_ICONS[categoryId];
          const isActive = activeCategoryId === categoryId;

          return (
            <li key={categoryId}>
              <button
                type="button"
                onClick={() => onSelect(categoryId)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive && 'bg-muted/30',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <MarketCategoryIcon icon={Icon} />
                <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                  {t(marketCategoryLabelKey(categoryId))}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
