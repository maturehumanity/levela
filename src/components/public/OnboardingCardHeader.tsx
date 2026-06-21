import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type OnboardingCardHeaderProps = {
  icon: LucideIcon;
  title: string;
  tone?: string;
  size?: 'sm' | 'md';
  className?: string;
  titleClassName?: string;
};

export function OnboardingCardHeader({
  icon: Icon,
  title,
  tone = 'bg-primary/12 text-primary',
  size = 'sm',
  className,
  titleClassName,
}: OnboardingCardHeaderProps) {
  const tileClass =
    size === 'md'
      ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl'
      : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl';

  const defaultTitleClass =
    size === 'md' ? 'text-base font-semibold leading-snug text-foreground' : 'text-sm font-semibold leading-snug text-foreground';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(tileClass, tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className={cn(defaultTitleClass, titleClassName)}>{title}</h3>
    </div>
  );
}
