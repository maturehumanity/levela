import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAccessiblePageLinks } from '@/lib/app-pages';
import { cn } from '@/lib/utils';

function getInitials(name?: string | null, username?: string | null) {
  const source = name?.trim() || username?.trim() || '?';
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserPageMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const pageLinks = useMemo(
    () => getAccessiblePageLinks(profile?.effective_permissions || []),
    [profile?.effective_permissions],
  );

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      clearCloseTimer();
    };
  }, []);

  return (
    <div className="relative h-12 w-12 overflow-visible" ref={panelRef}>
      <motion.div
        layout
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className={cn(
          'absolute right-0 top-0 overflow-hidden rounded-3xl backdrop-blur supports-[backdrop-filter]:bg-card/90',
          open ? 'border border-border/70 bg-card/95 shadow-lg' : 'border border-transparent bg-transparent shadow-none',
        )}
        animate={{ width: open ? 320 : 48 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.82 }}
      >
        <button
          type="button"
          aria-label={t('home.profileMenuButton')}
          onClick={() => {
            clearCloseTimer();
            setOpen((current) => !current);
          }}
          className={cn(
            'flex w-full items-center justify-end gap-3 outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-primary',
            open ? 'min-h-14 px-3 py-2.5' : 'h-12 px-0 py-0',
          )}
        >
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="profile-summary"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="min-w-0 flex-1 pl-4 text-left"
              >
                <p className="truncate text-sm font-semibold text-foreground">
                  {profile?.full_name || t('common.anonymousUser')}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.username ? `@${profile.username}` : t('home.profileMenuNoUsername')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <Avatar className={cn('shrink-0 border-2 border-border', open ? 'h-10 w-10' : 'h-12 w-12')}>
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(profile?.full_name, profile?.username)}
            </AvatarFallback>
          </Avatar>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="page-list"
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="border-t border-border/60"
            >
              <div className="max-h-[340px] overflow-y-auto p-2 pt-2">
                {pageLinks.map((page) => {
                  const Icon = page.icon;
                  const isCurrent = location.pathname === page.path;

                  return (
                    <button
                      key={page.path}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-accent/70',
                        isCurrent && 'bg-primary/10 text-primary hover:bg-primary/10',
                      )}
                      onClick={() => {
                        navigate(page.path);
                        setOpen(false);
                      }}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/80',
                          isCurrent && 'border-primary/20 bg-primary/10 text-primary',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{t(page.labelKey)}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                            {t('home.currentPage')}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
