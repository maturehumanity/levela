import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type SecondaryNavItem = {
  id: string;
  label: string;
  disabled?: boolean;
  title?: string;
};

export type SecondaryNavFab = {
  label: string;
  ariaLabel: string;
  onClick: () => void;
};

export type PageSecondaryNavConfig = {
  items: SecondaryNavItem[];
  value: string;
  onChange: (id: string) => void;
  fab?: SecondaryNavFab | null;
};

type Registration = PageSecondaryNavConfig & {
  registrationId: string;
};

type PageSecondaryNavContextValue = {
  config: PageSecondaryNavConfig | null;
  register: (config: PageSecondaryNavConfig) => string;
  updateConfig: (config: PageSecondaryNavConfig) => void;
  unregister: (registrationId: string) => void;
  carouselVisible: boolean;
  setCarouselVisible: (visible: boolean) => void;
  scheduleCarouselHide: () => void;
  cancelCarouselHide: () => void;
};

const PageSecondaryNavContext = createContext<PageSecondaryNavContextValue | null>(null);

const AUTO_HIDE_MS = 3000;

export function PageSecondaryNavProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registrationCounter = useRef(0);

  const cancelCarouselHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleCarouselHide = useCallback(() => {
    cancelCarouselHide();
    hideTimerRef.current = setTimeout(() => {
      setCarouselVisible(false);
      hideTimerRef.current = null;
    }, AUTO_HIDE_MS);
  }, [cancelCarouselHide]);

  const register = useCallback((config: PageSecondaryNavConfig) => {
    registrationCounter.current += 1;
    const registrationId = `secondary-nav-${registrationCounter.current}`;
    setRegistration({ ...config, registrationId });
    setCarouselVisible(true);
    scheduleCarouselHide();
    return registrationId;
  }, [scheduleCarouselHide]);

  const updateConfig = useCallback((config: PageSecondaryNavConfig) => {
    setRegistration((current) => {
      if (!current) return current;
      return { ...config, registrationId: current.registrationId };
    });
  }, []);

  const unregister = useCallback((registrationId: string) => {
    setRegistration((current) => (current?.registrationId === registrationId ? null : current));
    setCarouselVisible(false);
    cancelCarouselHide();
  }, [cancelCarouselHide]);

  const config = useMemo<PageSecondaryNavConfig | null>(() => {
    if (!registration) return null;
    return {
      items: registration.items,
      value: registration.value,
      onChange: registration.onChange,
      fab: registration.fab,
    };
  }, [registration]);

  const value = useMemo(
    () => ({
      config,
      register,
      updateConfig,
      unregister,
      carouselVisible,
      setCarouselVisible,
      scheduleCarouselHide,
      cancelCarouselHide,
    }),
    [config, register, updateConfig, unregister, carouselVisible, scheduleCarouselHide, cancelCarouselHide],
  );

  return (
    <PageSecondaryNavContext.Provider value={value}>
      {children}
    </PageSecondaryNavContext.Provider>
  );
}

export function usePageSecondaryNavContext() {
  const context = useContext(PageSecondaryNavContext);
  if (!context) {
    throw new Error('usePageSecondaryNavContext must be used within PageSecondaryNavProvider');
  }
  return context;
}

export { AUTO_HIDE_MS };
