import { useEffect, useRef } from 'react';

import {
  usePageSecondaryNavContext,
  type PageSecondaryNavConfig,
} from '@/contexts/PageSecondaryNavContext';

export function usePageSecondaryNav(config: PageSecondaryNavConfig | null) {
  const { register, unregister, updateConfig } = usePageSecondaryNavContext();
  const registrationIdRef = useRef<string | null>(null);
  const configRef = useRef(config);
  const itemIdsKey = config?.items.map((item) => item.id).join('|') ?? '';

  configRef.current = config;

  useEffect(() => {
    const current = configRef.current;
    if (!current || current.items.length === 0) {
      if (registrationIdRef.current) {
        unregister(registrationIdRef.current);
        registrationIdRef.current = null;
      }
      return;
    }

    const registrationId = register({
      items: current.items,
      value: current.value,
      onChange: (id) => configRef.current?.onChange(id),
      fab: current.fab ?? null,
    });
    registrationIdRef.current = registrationId;

    return () => {
      unregister(registrationId);
      registrationIdRef.current = null;
    };
  }, [itemIdsKey, register, unregister]);

  useEffect(() => {
    const current = configRef.current;
    if (!registrationIdRef.current || !current || current.items.length === 0) return;

    updateConfig({
      items: current.items,
      value: current.value,
      onChange: (id) => configRef.current?.onChange(id),
      fab: current.fab ?? null,
    });
  }, [itemIdsKey, config?.value, config?.fab?.label, config?.fab?.ariaLabel, updateConfig]);
}
