import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  baseTranslations,
  detectLanguageCode,
  getTranslationNode,
  getStoredLanguage,
  languageOptions,
  isRtlLanguage,
  loadLanguagePack,
  translateMessage,
  type LanguageCode,
  type TranslationTree,
} from '@/lib/i18n';

const LANGUAGE_STORAGE_KEY = 'levela-language';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  getNode: (key: string) => unknown;
  languageOptions: typeof languageOptions;
  isLoadingLanguage: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): LanguageCode {
  if (typeof window !== 'undefined') {
    const stored = getStoredLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (stored) return stored;
  }

  return detectLanguageCode();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(() => getInitialLanguage());
  const [messages, setMessages] = useState<TranslationTree>(baseTranslations);
  const [isLoadingLanguage, setIsLoadingLanguage] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.lang = language;
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    let active = true;

    const loadMessages = async () => {
      if (language === 'en') {
        if (active) {
          setMessages(baseTranslations);
          setIsLoadingLanguage(false);
        }
        return;
      }

      if (active) {
        setIsLoadingLanguage(true);
      }

      const nextMessages = await loadLanguagePack(language);

      if (!active) return;

      setMessages(nextMessages);
      setIsLoadingLanguage(false);
    };

    void loadMessages();

    return () => {
      active = false;
    };
  }, [language]);

  useEffect(() => {
    if (!profile?.language_code) return;

    const profileLanguage = getStoredLanguage(profile.language_code) || detectLanguageCode();
    setLanguageState(profileLanguage);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, profileLanguage);
    }
  }, [profile?.language_code]);

  const setLanguage = useCallback(async (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }

    if (!profile?.id) return;

    const { error } = await supabase
      .from('profiles')
      .update({ language_code: nextLanguage })
      .eq('id', profile.id);

    if (!error) {
      await refreshProfile();
    }
  }, [profile?.id, refreshProfile]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => translateMessage(messages, key, vars),
      getNode: (key) => getTranslationNode(messages, key),
      languageOptions,
      isLoadingLanguage,
    }),
    [language, messages, isLoadingLanguage, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
