import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Onboarding from '@/pages/Onboarding';
import { ANDROID_DOWNLOAD_URL } from '@/lib/downloads';
import { APP_VERSION } from '@/lib/app-release';

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          <div {...props}>{children}</div>,
    },
  ),
  useReducedMotion: () => true,
}));
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value} />,
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
vi.mock('@/lib/i18n.runtime', async () => {
  const actual = await vi.importActual<typeof import('@/lib/i18n.runtime')>('@/lib/i18n.runtime');

  return {
    ...actual,
    loadLanguageOptions: async () => [{ code: 'en', label: 'English' }],
  };
});

describe('Onboarding public page', () => {
  it('shows product, proof, and faq content for new visitors', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText('What Levela is today')).toBeInTheDocument();
    expect(screen.getByText(`Current build: ${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText('Outcomes we pursue')).toBeInTheDocument();
    expect(screen.getByText('How the system fits together')).toBeInTheDocument();
    expect(screen.getByText('Open, auditable, and documented')).toBeInTheDocument();
    expect(screen.getByText('Choose your path')).toBeInTheDocument();
    expect(screen.getByText('Common questions')).toBeInTheDocument();
    expect(screen.getByText('What is Levela?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open-source repository/i })).toHaveAttribute(
      'href',
      'https://github.com/maturehumanity/levela',
    );
    expect(screen.getAllByRole('link', { name: 'Terms' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', 'https://levela.yeremyan.net');
  });

  it('shows the public app download card with qr code and actions', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText('Try the Android build')).toBeInTheDocument();
    expect(screen.getByText('Early access · Testing build')).toBeInTheDocument();
    expect(screen.getByText('Scan to install on your phone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download the Android test build' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open download page' })).toBeInTheDocument();
    expect(await screen.findByTestId('qr-code')).toHaveAttribute('data-value', ANDROID_DOWNLOAD_URL);
  });
});
