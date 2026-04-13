import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Settings from '@/pages/Settings';
import { APP_VERSION_TAG, ANDROID_VERSION_CODE } from '@/lib/app-release';
import { APP_UPDATE_CHANNEL_KEY, getAppUpdateChannel } from '@/lib/update-channel';

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          <div {...props}>{children}</div>,
    },
  ),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signOut: async () => {},
    profile: {
      effective_permissions: [],
    },
  }),
}));

vi.mock('@/contexts/LanguageContext', async () => {
  const { baseTranslations, translateMessage } = await import('@/lib/i18n');

  return {
    useLanguage: () => ({
      language: 'en',
      setLanguage: async () => {},
      t: (key: string, vars?: Record<string, string | number>) => translateMessage(baseTranslations, key, vars),
      getNode: (key: string) => key,
      languageOptions: [{ code: 'en', label: 'English' }],
      isLoadingLanguage: false,
    }),
  };
});

describe('Settings page', () => {
  it('shows the installed app version and build', () => {
    window.localStorage.removeItem(APP_UPDATE_CHANNEL_KEY);

    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );

    const expectedLabel = getAppUpdateChannel() === 'testing'
      ? `Testing ${APP_VERSION_TAG} (${ANDROID_VERSION_CODE})`
      : `${APP_VERSION_TAG} (${ANDROID_VERSION_CODE})`;

    expect(screen.getByText('Application version')).toBeInTheDocument();
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });
});
