import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type PublicThemeToggleProps = {
  className?: string;
};

export function PublicThemeToggle({ className }: PublicThemeToggleProps) {
  const { setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn('h-9 w-9 shrink-0 border-border/60 bg-card/80', className)}
        >
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('common.theme')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>{t('common.light')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>{t('common.dark')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>{t('common.system')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
