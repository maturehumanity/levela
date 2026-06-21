import type { ReactNode } from 'react';

import { PublicPageToolbar } from '@/components/public/PublicPageToolbar';
import { cn } from '@/lib/utils';

type PublicPageShellProps = {
  children: ReactNode;
  contentClassName?: string;
  maxWidthClass?: string;
};

export function PublicPageShell({
  children,
  contentClassName,
  maxWidthClass = 'max-w-3xl',
}: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col safe-top">
      <div className={cn('relative mx-auto flex w-full items-center justify-end px-6 pt-4 sm:px-8', maxWidthClass)}>
        <PublicPageToolbar />
      </div>
      <div className={cn('flex-1', contentClassName)}>{children}</div>
    </div>
  );
}
