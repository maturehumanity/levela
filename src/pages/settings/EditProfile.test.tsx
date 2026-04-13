import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditProfile from '@/pages/settings/EditProfile';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="identity-qr" data-value={value} />,
}));

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
vi.stubGlobal('ResizeObserver', MockResizeObserver);

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => {
          const {
            layoutId,
            whileTap,
            whileHover,
            initial,
            animate,
            exit,
            transition,
            variants,
            ...rest
          } = props as Record<string, unknown>;

          return <div {...(rest as React.HTMLAttributes<HTMLElement>)}>{children}</div>;
        },
    },
  ),
}));

vi.mock('@/contexts/LanguageContext', async () => {
  const { baseTranslations, translateMessage } = await import('@/lib/i18n');

  return {
    useLanguage: () => ({
      language: 'en',
      setLanguage: async () => {},
      t: (key: string, vars?: Record<string, string | number>) => translateMessage(baseTranslations, key, vars),
      getNode: (key: string) => key,
      languageOptions: [],
      isLoadingLanguage: false,
    }),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'profile-1',
      user_id: 'user-1',
      username: 'armen',
      full_name: 'Armen Yeremyan',
      avatar_url: null,
      bio: 'Testing identity visibility.',
      date_of_birth: '1990-03-26',
      country: 'United States',
      country_code: 'US',
      official_id: 'FABCD2345',
      social_security_number: 'LVLA-A1B2-C3D4',
      full_name_change_count: 0,
      full_name_last_changed_at: null,
      language_code: 'en',
      is_verified: false,
      is_admin: true,
      role: 'admin',
      custom_permissions: [],
      granted_permissions: [],
      denied_permissions: [],
      effective_permissions: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  },
}));

describe('Edit Profile identity block', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows masked generated identity values and reveals them on demand', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EditProfile />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Identity')).not.toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('SSN')).toBeInTheDocument();
    expect(screen.getAllByText(/World Citizen ID/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Social Card').length).toBeGreaterThan(0);
    expect(screen.getByText('LVLA-A1B2-C3D4')).toBeInTheDocument();
    expect(screen.getByText('••••')).toBeInTheDocument();
    expect(screen.getByText('D2345')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Show full ID'));

    expect(screen.getByText('FABC')).toBeInTheDocument();
    expect(screen.getByText('D2345')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Social Card front'));

    expect(screen.getByTestId('identity-qr')).toBeInTheDocument();
  });

  it('clears stale legacy edit-profile layout storage', () => {
    const legacyKey = 'levela-edit-profile-layout-v1:profile-1';

    window.localStorage.setItem(legacyKey, JSON.stringify({ wcFrontTitle: { x: 12, y: -4 } }));
    window.localStorage.setItem(
      'levela-global-build-v1',
      JSON.stringify({
        '/': {
          '[data-build-key="wcFrontTitle"]': { x: 12, y: -4, label: 'Legacy title' },
        },
      }),
    );
    window.localStorage.setItem(
      'levela-global-build-groups-v1',
      JSON.stringify({
        '/': [
          {
            id: 'legacy-group',
            label: 'Legacy group',
            members: ['[data-build-key="wcFrontTitle"]'],
          },
        ],
      }),
    );
    window.localStorage.setItem(
      'levela-global-build-parents-v1',
      JSON.stringify({
        '/': {
          '[data-build-key="wcFrontTitle"]': '[data-build-key="wcFrontHeaderGroup"]',
        },
      }),
    );
    window.localStorage.setItem(
      'levela-global-build-orders-v1',
      JSON.stringify({
        '/': {
          '[data-build-key="wcFrontTitle"]': 1,
        },
      }),
    );

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <EditProfile />
      </MemoryRouter>,
    );

    expect(window.localStorage.getItem(legacyKey)).toBeNull();

    expect(window.localStorage.getItem('levela-global-build-v1')).toBeNull();
    expect(window.localStorage.getItem('levela-global-build-groups-v1')).toBeNull();
    expect(window.localStorage.getItem('levela-global-build-parents-v1')).toBeNull();
    expect(window.localStorage.getItem('levela-global-build-orders-v1')).toBeNull();

    expect(window.localStorage.getItem('levela-edit-profile-layout-schema-v1:/')).toBe('3');
  });
});
