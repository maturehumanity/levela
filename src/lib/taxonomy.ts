export type CardCategory = {
  code: string;
  label: string;
};

const CARD_CATEGORIES_STORAGE_KEY = 'levela-taxonomy-card-categories-v1';
const PROFILE_CARD_CATEGORY_STORAGE_KEY = 'levela-profile-card-category-v1';
const DEFAULT_CARD_CATEGORY_CODE = 'N';

const DEFAULT_CARD_CATEGORIES: CardCategory[] = [
  { code: 'N', label: 'Native' },
  { code: 'IR1', label: 'Spouse of a U.S. citizen' },
  { code: 'CR1', label: 'Conditional spouse of a U.S. citizen' },
  { code: 'IR2', label: 'Child of a U.S. citizen' },
  { code: 'CR2', label: 'Conditional child of a U.S. citizen' },
  { code: 'IR5', label: 'Parent of a U.S. citizen' },
  { code: 'F11', label: 'Unmarried son or daughter of a U.S. citizen' },
  { code: 'F21', label: 'Spouse of a lawful permanent resident' },
  { code: 'F22', label: 'Child of a lawful permanent resident' },
  { code: 'F24', label: 'Unmarried son or daughter of a lawful permanent resident' },
  { code: 'F31', label: 'Married son or daughter of a U.S. citizen' },
  { code: 'F41', label: 'Brother or sister of a U.S. citizen' },
  { code: 'E11', label: 'EB-1 priority worker' },
  { code: 'E21', label: 'EB-2 advanced degree or exceptional ability' },
  { code: 'E31', label: 'EB-3 skilled worker or professional' },
  { code: 'EW3', label: 'EB-3 other worker' },
  { code: 'SD1', label: 'Minister of religion' },
  { code: 'SR1', label: 'Religious worker' },
  { code: 'SQ1', label: 'Afghan or Iraqi special immigrant' },
  { code: 'C51', label: 'EB-5 targeted employment area investor' },
  { code: 'T51', label: 'EB-5 investor' },
  { code: 'DV1', label: 'Diversity immigrant' },
  { code: 'RE6', label: 'Refugee adjustment' },
  { code: 'AS6', label: 'Asylee adjustment' },
  { code: 'SB1', label: 'Returning resident' },
];

function sanitizeCardCategory(value: unknown): CardCategory | null {
  if (!value || typeof value !== 'object') return null;
  const code = typeof (value as { code?: unknown }).code === 'string' ? (value as { code: string }).code.trim().toUpperCase() : '';
  const label = typeof (value as { label?: unknown }).label === 'string' ? (value as { label: string }).label.trim() : '';
  if (!code || !label) return null;
  return { code, label };
}

function getWindowStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getDefaultCardCategoryCode() {
  return DEFAULT_CARD_CATEGORY_CODE;
}

export function getDefaultCardCategories() {
  return DEFAULT_CARD_CATEGORIES.map((category) => ({ ...category }));
}

export function getStoredCardCategories() {
  const storage = getWindowStorage();
  if (!storage) return getDefaultCardCategories();

  const raw = storage.getItem(CARD_CATEGORIES_STORAGE_KEY);
  if (!raw) return getDefaultCardCategories();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultCardCategories();
    const sanitized = parsed.map(sanitizeCardCategory).filter(Boolean) as CardCategory[];
    if (!sanitized.length) return getDefaultCardCategories();
    return sanitized;
  } catch {
    return getDefaultCardCategories();
  }
}

export function saveCardCategories(categories: CardCategory[]) {
  const storage = getWindowStorage();
  if (!storage) return;

  const next = categories
    .map((category) => sanitizeCardCategory(category))
    .filter(Boolean) as CardCategory[];

  storage.setItem(CARD_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
}

export function getCardCategoryMap() {
  return Object.fromEntries(getStoredCardCategories().map((category) => [category.code, category]));
}

export function getStoredProfileCardCategory(profileId?: string | null) {
  if (!profileId) return DEFAULT_CARD_CATEGORY_CODE;

  const storage = getWindowStorage();
  const categories = getCardCategoryMap();
  if (!storage) return categories[DEFAULT_CARD_CATEGORY_CODE]?.code || DEFAULT_CARD_CATEGORY_CODE;

  const raw = storage.getItem(PROFILE_CARD_CATEGORY_STORAGE_KEY);
  if (!raw) return categories[DEFAULT_CARD_CATEGORY_CODE]?.code || DEFAULT_CARD_CATEGORY_CODE;

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const stored = typeof parsed?.[profileId] === 'string' ? parsed[profileId].trim().toUpperCase() : '';
    if (stored && categories[stored]) return stored;
  } catch {
    return categories[DEFAULT_CARD_CATEGORY_CODE]?.code || DEFAULT_CARD_CATEGORY_CODE;
  }

  return categories[DEFAULT_CARD_CATEGORY_CODE]?.code || DEFAULT_CARD_CATEGORY_CODE;
}

export function saveProfileCardCategory(profileId: string, categoryCode: string) {
  const storage = getWindowStorage();
  if (!storage) return;

  const normalized = categoryCode.trim().toUpperCase() || DEFAULT_CARD_CATEGORY_CODE;
  const raw = storage.getItem(PROFILE_CARD_CATEGORY_STORAGE_KEY);

  let current: Record<string, string> = {};
  if (raw) {
    try {
      current = JSON.parse(raw) as Record<string, string>;
    } catch {
      current = {};
    }
  }

  current[profileId] = normalized;
  storage.setItem(PROFILE_CARD_CATEGORY_STORAGE_KEY, JSON.stringify(current));
}
