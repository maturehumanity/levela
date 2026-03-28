import { baseTranslations, type BaseTranslations } from './i18n.base';
import {
  languageOptions as rawLanguageOptions,
  primaryLanguageCodes,
  supportedLanguageCodes,
  type LanguageCode,
  type LanguageOption,
} from './i18n.languages';

export type LocalePreferences = {
  languageCode: LanguageCode;
  country: string;
};

export type TranslationTree = BaseTranslations;

const LANGUAGE_PACK_PREFIX = 'levela-i18n-pack';
const LANGUAGE_PACK_VERSION = '25';
const FALLBACK_LANGUAGE: LanguageCode = 'en';
const inFlightLanguageLoads = new Map<LanguageCode, Promise<TranslationTree>>();
const cachedLanguagePacks = new Map<LanguageCode, TranslationTree>();

const rtlLanguages = new Set<LanguageCode | string>([
  'ar',
  'fa',
  'he',
  'iw',
  'ps',
  'ur',
  'yi',
  'sd',
  'ug',
  'pa-Arab',
  'ms-Arab',
]);

function normalizeLocaleCode(value: string): string {
  return value.trim().replace(/_/g, '-');
}

function capitalizeDisplayLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const first = trimmed[0];
  if (first.toLocaleLowerCase() === first.toLocaleUpperCase()) {
    return trimmed;
  }

  return `${first.toLocaleUpperCase()}${trimmed.slice(1)}`;
}

function getLanguageStorageKey(language: LanguageCode): string {
  return `${LANGUAGE_PACK_PREFIX}:${LANGUAGE_PACK_VERSION}:${language}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolvePath(object: unknown, path: string): unknown {
  if (!isObject(object)) return undefined;
  if (path in object) return object[path];

  const [head, ...rest] = path.split('.');
  if (!(head in object)) return undefined;
  if (rest.length === 0) return object[head];

  return resolvePath(object[head], rest.join('.'));
}

export function getTranslationNode(messages: TranslationTree, key: string): unknown {
  return resolvePath(messages, key) ?? resolvePath(baseTranslations, key);
}

function getBrowserLocale(): string {
  if (typeof navigator === 'undefined') return 'en-US';
  return navigator.languages?.[0] || navigator.language || 'en-US';
}

export function detectLanguageCode(locale = getBrowserLocale()): LanguageCode {
  const normalized = normalizeLocaleCode(locale).toLowerCase();
  return (
    primaryLanguageCodes[normalized] ||
    primaryLanguageCodes[normalized.split('-')[0] || ''] ||
    FALLBACK_LANGUAGE
  );
}

export function detectCountry(locale = getBrowserLocale()): string {
  const normalized = normalizeLocaleCode(locale);
  const parts = normalized.split('-');
  const region = parts.find((part) => part.length === 2 || part.length === 3);

  if (!region) {
    const fallbackRegion = detectLanguageCode(locale) === 'es' ? 'ES' : 'US';

    try {
      if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
        const displayNames = new Intl.DisplayNames([detectLanguageCode(locale)], { type: 'region' });
        return displayNames.of(fallbackRegion) || (fallbackRegion === 'ES' ? 'Spain' : 'United States');
      }
    } catch {
      // fall through to the code
    }

    return fallbackRegion === 'ES' ? 'Spain' : 'United States';
  }

  const countryCode = region.toUpperCase();
  try {
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      const displayNames = new Intl.DisplayNames([detectLanguageCode(locale)], { type: 'region' });
      return displayNames.of(countryCode) || countryCode;
    }
  } catch {
    // fall through to the code
  }

  return countryCode;
}

export function detectLocalePreferences(): LocalePreferences {
  const locale = getBrowserLocale();
  return {
    languageCode: detectLanguageCode(locale),
    country: detectCountry(locale),
  };
}

export function getStoredLanguage(value: string | null | undefined): LanguageCode | null {
  if (!value) return null;
  const normalized = normalizeLocaleCode(value).toLowerCase();
  return primaryLanguageCodes[normalized] || primaryLanguageCodes[normalized.split('-')[0] || ''] || null;
}

export function languageFromProfile(languageCode?: string | null): LanguageCode {
  return getStoredLanguage(languageCode) || FALLBACK_LANGUAGE;
}

export function isRtlLanguage(language: LanguageCode): boolean {
  const normalized = language.toLowerCase();
  return rtlLanguages.has(normalized) || rtlLanguages.has(normalized.split('-')[0]);
}

function translateText(input: string, targetLanguage: LanguageCode, cache: Map<string, string>): Promise<string> {
  if (targetLanguage === FALLBACK_LANGUAGE) return Promise.resolve(input);
  if (cache.has(input)) return Promise.resolve(cache.get(input) as string);

  const placeholders: string[] = [];
  const protectedText = input.replace(/\{([^}]+)\}/g, (_match, token) => {
    const placeholder = `__PH_${placeholders.length}__`;
    placeholders.push(`{${token}}`);
    return placeholder;
  });

  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', targetLanguage);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', protectedText);

  return fetch(url)
    .then((response) => response.json())
    .then((payload) => {
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((part: [string] | undefined) => part?.[0] ?? '').join('')
        : '';
      const restored = (translated || input).replace(/__PH_(\d+)__/g, (_match, index) => placeholders[Number(index)] ?? _match);
      cache.set(input, restored);
      return restored;
    })
    .catch(() => input);
}

async function translateTree(node: unknown, targetLanguage: LanguageCode, cache: Map<string, string>): Promise<unknown> {
  if (typeof node === 'string') {
    return translateText(node, targetLanguage, cache);
  }

  if (Array.isArray(node)) {
    return Promise.all(node.map((item) => translateTree(item, targetLanguage, cache)));
  }

  if (isObject(node)) {
    const entries = await Promise.all(
      Object.entries(node).map(async ([key, value]) => [key, await translateTree(value, targetLanguage, cache)] as const)
    );
    return Object.fromEntries(entries);
  }

  return node;
}

function readPackedLanguage(language: LanguageCode): TranslationTree | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getLanguageStorageKey(language));
    if (!raw) return null;
    return JSON.parse(raw) as TranslationTree;
  } catch {
    return null;
  }
}

function persistPackedLanguage(language: LanguageCode, messages: TranslationTree) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getLanguageStorageKey(language), JSON.stringify(messages));
  } catch {
    // Ignore quota / serialization issues.
  }
}

export async function loadLanguagePack(language: LanguageCode): Promise<TranslationTree> {
  if (language === FALLBACK_LANGUAGE) return baseTranslations;

  const cached = cachedLanguagePacks.get(language) || readPackedLanguage(language);
  if (cached) {
    cachedLanguagePacks.set(language, cached);
    return cached;
  }

  const inFlight = inFlightLanguageLoads.get(language);
  if (inFlight) return inFlight;

  const promise = translateTree(baseTranslations, language, new Map())
    .then((messages) => {
      const tree = messages as TranslationTree;
      cachedLanguagePacks.set(language, tree);
      persistPackedLanguage(language, tree);
      return tree;
    })
    .catch((error) => {
      console.error(`Failed to load language pack for ${language}:`, error);
      return baseTranslations;
    })
    .finally(() => {
      inFlightLanguageLoads.delete(language);
    });

  inFlightLanguageLoads.set(language, promise);
  return promise;
}

export function translateMessage(messages: TranslationTree, key: string, vars?: Record<string, string | number>): string {
  const template = resolvePath(messages, key) ?? resolvePath(baseTranslations, key) ?? key;
  if (typeof template !== 'string') return key;

  return template.replace(/\{(\w+)\}/g, (_match, token) => {
    const value = vars?.[token];
    return value === undefined || value === null ? `{${token}}` : String(value);
  });
}

export const languageOptions = rawLanguageOptions.map((option) => ({
  ...option,
  label: capitalizeDisplayLabel(option.label),
})) as readonly LanguageOption[];

export {
  baseTranslations,
  primaryLanguageCodes,
  supportedLanguageCodes,
  type LanguageCode,
  type LanguageOption,
};
