import { Package, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { MarketListingKind } from '@/lib/use-market-published-listings';
import { cn } from '@/lib/utils';

type MarketListingKindIconToggleProps = {
  value: MarketListingKind;
  onChange: (kind: MarketListingKind) => void;
  productsLabel: string;
  servicesLabel: string;
  groupLabel: string;
};

function kindButtonClass(active: boolean) {
  return cn(
    'h-8 w-8 shrink-0',
    active
      ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
      : 'text-muted-foreground hover:text-foreground',
  );
}

export function MarketListingKindIconToggle({
  value,
  onChange,
  productsLabel,
  servicesLabel,
  groupLabel,
}: MarketListingKindIconToggleProps) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={groupLabel}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={kindButtonClass(value === 'product')}
        onClick={() => onChange('product')}
        aria-label={productsLabel}
        aria-pressed={value === 'product'}
      >
        <Package className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={kindButtonClass(value === 'service')}
        onClick={() => onChange('service')}
        aria-label={servicesLabel}
        aria-pressed={value === 'service'}
      >
        <Wrench className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
