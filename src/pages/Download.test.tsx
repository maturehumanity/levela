import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import DownloadPage from '@/pages/Download';
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

describe('Download page', () => {
  it('shows the Android download card and iPhone coming-soon state', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DownloadPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Download Levela')).toBeInTheDocument();
    expect(screen.getByText('Android test build')).toBeInTheDocument();
    expect(screen.getByText('iPhone test build')).toBeInTheDocument();

    const androidLink = screen.getByRole('link', { name: 'Download Android APK' });
    expect(androidLink).toHaveAttribute('href', ANDROID_DOWNLOAD_URL);

    expect(screen.getByRole('button', { name: 'iPhone build coming soon' })).toBeDisabled();
  });
});
