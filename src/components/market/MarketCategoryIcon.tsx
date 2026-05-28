import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type MarketCategoryIconProps = {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
};

export function MarketCategoryIcon({ icon: Icon, className, iconClassName }: MarketCategoryIconProps) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted',
        className,
      )}
      aria-hidden
    >
      <Icon className={cn('h-[18px] w-[18px] text-foreground', iconClassName)} strokeWidth={2.25} />
    </span>
  );
}
