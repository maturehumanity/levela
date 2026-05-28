import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  Baby,
  Bookmark,
  BookOpen,
  Box,
  Briefcase,
  Car,
  CircleDollarSign,
  Cog,
  Gamepad2,
  Gem,
  Guitar,
  Hammer,
  Home,
  MapPin,
  Package,
  Paintbrush,
  PawPrint,
  PersonStanding,
  Smartphone,
  Sparkles,
  SprayCan,
  Shirt,
  ShoppingBag,
  Tag,
  TreePine,
  UtensilsCrossed,
} from 'lucide-react';

/** Primary tabs shown first in the bottom carousel. */
export const MARKET_PRIMARY_TAB_IDS = [
  'saved',
  'sell',
  'for-you',
  'local',
  'jobs',
  'vehicles',
  'rentals',
  'womenswear',
  'menswear',
  'furniture',
  'electronics',
] as const;

export type MarketPrimaryTabId = (typeof MARKET_PRIMARY_TAB_IDS)[number];

/** Browse categories (Facebook Marketplace-style). */
export const MARKET_BROWSE_CATEGORY_IDS = [
  'antiques-collectibles',
  'arts-crafts',
  'auto-parts',
  'baby',
  'books-movies-music',
  'electronics',
  'furniture',
  'garage-sale',
  'health-beauty',
  'home-kitchen',
  'home-improvement',
  'housing-for-sale',
  'jewelry-watches',
  'kidswear-baby',
  'luggage-bags',
  'menswear',
  'miscellaneous',
  'musical-instruments',
  'patio-garden',
  'pet-supplies',
  'rentals',
  'sporting-goods',
  'toys-games',
  'vehicles',
  'womenswear',
] as const;

export type MarketBrowseCategoryId = (typeof MARKET_BROWSE_CATEGORY_IDS)[number];

export type MarketSectionId = MarketPrimaryTabId | MarketBrowseCategoryId;

/** All sections in the market bottom strip (primary tabs, then browse-only categories). */
export const MARKET_CAROUSEL_SECTION_IDS: MarketSectionId[] = [
  ...MARKET_PRIMARY_TAB_IDS,
  ...MARKET_BROWSE_CATEGORY_IDS.filter(
    (id) => !(MARKET_PRIMARY_TAB_IDS as readonly string[]).includes(id),
  ),
];

export const MARKET_CATEGORY_ICONS: Record<MarketSectionId, LucideIcon> = {
  saved: Bookmark,
  sell: Tag,
  'for-you': Sparkles,
  local: MapPin,
  jobs: Briefcase,
  vehicles: Car,
  rentals: Home,
  womenswear: Shirt,
  menswear: ShoppingBag,
  furniture: Armchair,
  electronics: Smartphone,
  'antiques-collectibles': Gem,
  'arts-crafts': Paintbrush,
  'auto-parts': Cog,
  baby: Baby,
  'books-movies-music': BookOpen,
  'garage-sale': Package,
  'health-beauty': SprayCan,
  'home-kitchen': UtensilsCrossed,
  'home-improvement': Hammer,
  'housing-for-sale': CircleDollarSign,
  'jewelry-watches': Gem,
  'kidswear-baby': Shirt,
  'luggage-bags': ShoppingBag,
  miscellaneous: Box,
  'musical-instruments': Guitar,
  'patio-garden': TreePine,
  'pet-supplies': PawPrint,
  'sporting-goods': PersonStanding,
  'toys-games': Gamepad2,
};

export function isMarketPrimaryTabId(id: string): id is MarketPrimaryTabId {
  return (MARKET_PRIMARY_TAB_IDS as readonly string[]).includes(id);
}

export function isMarketBrowseCategoryId(id: string): id is MarketBrowseCategoryId {
  return (MARKET_BROWSE_CATEGORY_IDS as readonly string[]).includes(id);
}

export function isMarketSectionId(id: string): id is MarketSectionId {
  return isMarketPrimaryTabId(id) || isMarketBrowseCategoryId(id);
}

export function parseMarketSectionParam(value: string | null): MarketSectionId | null {
  if (!value || !isMarketSectionId(value)) return null;
  return value;
}

/** i18n key under `market.categories.*` */
export function marketCategoryLabelKey(id: MarketSectionId): string {
  return `market.categories.${id}`;
}

/** Product browse categories only (excludes nav tabs like sell / for-you). */
export function isProductBrowseCategory(id: MarketSectionId): boolean {
  return isMarketBrowseCategoryId(id);
}
