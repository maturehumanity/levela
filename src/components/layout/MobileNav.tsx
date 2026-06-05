import { motion } from 'framer-motion';
import { Home, BookOpen, Store, Settings, MessageCircle, Plus } from 'lucide-react';
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { NavSecondaryCarousel } from '@/components/layout/NavSecondaryCarousel';
import { NavSecondaryStrip } from '@/components/layout/NavSecondaryStrip';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageSecondaryNavContext } from '@/contexts/PageSecondaryNavContext';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/study', icon: BookOpen, label: 'Study' },
  { path: '/market', icon: Store, label: 'Market' },
  { path: '/messaging', icon: MessageCircle, label: 'Messaging' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

function isNavItemActive(pathname: string, itemPath: string) {
  if (itemPath === '/messaging') {
    return pathname === '/messaging' || pathname.startsWith('/messaging/');
  }
  if (itemPath === '/study') {
    return pathname === '/study' || pathname.startsWith('/study/');
  }
  if (itemPath === '/market') {
    return pathname === '/market' || pathname.startsWith('/market/');
  }
  return pathname === itemPath;
}

function matchesSecondaryNavRoute(pathname: string, itemPath: string) {
  return isNavItemActive(pathname, itemPath);
}

const ACTIVE_NAV_DOUBLE_TAP_MS = 400;

function isSecondaryNavChromeTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-secondary-nav-chrome]'));
}

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { config, setCarouselVisible, cancelCarouselHide, scheduleCarouselHide } =
    usePageSecondaryNavContext();
  const lastActiveNavTapRef = useRef<{ path: string; at: number } | null>(null);

  const revealCarouselForActiveItem = (itemPath: string) => {
    if (!config || !matchesSecondaryNavRoute(location.pathname, itemPath)) return;
    setCarouselVisible(true);
    cancelCarouselHide();
  };

  const handleChromePointerLeave = (event: React.PointerEvent) => {
    if (isSecondaryNavChromeTarget(event.relatedTarget)) return;
    if (config?.persistCarousel) return;
    scheduleCarouselHide();
  };

  const handleNavItemPress = (itemPath: string, isActive: boolean, hasSecondaryNav: boolean) => {
    if (isActive && hasSecondaryNav) {
      const now = Date.now();
      const lastTap = lastActiveNavTapRef.current;
      if (
        lastTap?.path === itemPath &&
        now - lastTap.at < ACTIVE_NAV_DOUBLE_TAP_MS &&
        config?.defaultValue
      ) {
        lastActiveNavTapRef.current = null;
        config.onChange(config.defaultValue);
        revealCarouselForActiveItem(itemPath);
        return;
      }
      lastActiveNavTapRef.current = { path: itemPath, at: now };
      revealCarouselForActiveItem(itemPath);
      return;
    }
    lastActiveNavTapRef.current = null;
    navigate(itemPath);
  };

  return (
    <>
      {config?.layout === 'strip' ? <NavSecondaryStrip /> : <NavSecondaryCarousel />}
      {config?.fab ? (
        <div
          data-secondary-nav-chrome
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.15rem+env(safe-area-inset-bottom,0px))] z-[70] flex justify-center"
          onPointerEnter={cancelCarouselHide}
          onPointerLeave={handleChromePointerLeave}
        >
          <button
            type="button"
            onClick={() => config.fab?.onClick()}
            aria-label={config.fab.ariaLabel}
            className="group pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-md backdrop-blur-sm transition-colors hover:border-primary/65 hover:bg-primary/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/60 bg-popover/95 px-2.5 py-1 text-[10px] font-medium text-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              {config.fab.label}
            </span>
          </button>
        </div>
      ) : null}
      <nav
        data-secondary-nav-chrome
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/80 backdrop-blur-xl${config?.fab ? ' overflow-visible border-t-0' : ''}`}
        onPointerEnter={cancelCarouselHide}
        onPointerLeave={handleChromePointerLeave}
      >
        {config?.fab ? (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-[8] h-4 w-full -translate-y-full text-border/45"
            viewBox="0 0 360 16"
            preserveAspectRatio="none"
          >
            <path
              d="M0 16 H128 Q180 0 232 16 H360"
              fill="hsl(var(--background))"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        <div className="grid w-full grid-cols-5 pt-2 pb-[env(safe-area-inset-bottom,0px)]">
          {navItems.map((item) => {
            const isActive = isNavItemActive(location.pathname, item.path);
            const hasSecondaryNav = Boolean(config) && matchesSecondaryNavRoute(location.pathname, item.path);
            const Icon = item.icon;
            const labelKey =
              item.label === 'Home'
                ? 'common.home'
                : item.label === 'Study'
                  ? 'common.study'
                  : item.label === 'Messaging'
                    ? 'common.messaging'
                    : item.label === 'Market'
                      ? 'common.market'
                      : 'common.settings';

            return (
              <motion.button
                key={item.path}
                onClick={() => handleNavItemPress(item.path, isActive, hasSecondaryNav)}
                onPointerEnter={() => {
                  if (isActive && hasSecondaryNav) {
                    revealCarouselForActiveItem(item.path);
                  }
                }}
                onFocus={() => {
                  if (isActive && hasSecondaryNav) {
                    revealCarouselForActiveItem(item.path);
                  }
                }}
                onTouchStart={() => {
                  if (isActive && hasSecondaryNav) {
                    revealCarouselForActiveItem(item.path);
                  }
                }}
                className={`
                  flex w-full min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2
                  touch-target transition-colors duration-200
                  ${isActive
                    ? 'text-primary'
                    : 'text-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary)/0.7)]'
                  }
                `}
                whileTap={{ scale: 0.9 }}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-6 w-6 shrink-0" aria-hidden />
                <span className="max-w-full truncate text-center text-[10px] font-medium leading-tight">
                  {t(labelKey)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
