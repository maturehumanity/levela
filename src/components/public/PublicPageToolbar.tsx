import { PublicLanguageSelect } from '@/components/public/PublicLanguageSelect';
import { PublicThemeToggle } from '@/components/public/PublicThemeToggle';
import { cn } from '@/lib/utils';

type PublicPageToolbarProps = {
  className?: string;
};

export function PublicPageToolbar({ className }: PublicPageToolbarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <PublicLanguageSelect />
      <PublicThemeToggle />
    </div>
  );
}
