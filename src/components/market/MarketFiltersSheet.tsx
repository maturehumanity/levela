import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type MarketFiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
};

/** Phase 3: price range, distance, and more. Placeholder shell for now. */
export function MarketFiltersSheet({ open, onOpenChange, t }: MarketFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle>{t('market.filtersTitle')}</SheetTitle>
          <SheetDescription>{t('market.filtersSubtitle')}</SheetDescription>
        </SheetHeader>
        <p className="mt-4 text-sm text-muted-foreground">{t('market.filtersComingSoon')}</p>
      </SheetContent>
    </Sheet>
  );
}
