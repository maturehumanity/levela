import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Onboarding from '@/pages/Onboarding';
import { ANDROID_DOWNLOAD_URL } from '@/lib/downloads';

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

describe('Onboarding download access', () => {
  it('shows the public app download card with qr code and actions', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText('Download app')).toBeInTheDocument();
    expect(screen.getByText('Scan to install on your phone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download the Android test build' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open download page' })).toBeInTheDocument();
    expect(await screen.findByTestId('qr-code')).toHaveAttribute('data-value', ANDROID_DOWNLOAD_URL);
  });
});
