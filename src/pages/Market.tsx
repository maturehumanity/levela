import { FileSignature, ListFilter, Search, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { MarketFiltersSheet } from '@/components/market/MarketFiltersSheet';
import { MarketListingCard } from '@/components/market/MarketListingCard';
import { MarketListingKindIconToggle } from '@/components/market/MarketListingKindIconToggle';
import { PostMarketListingDialog } from '@/components/market/PostMarketListingDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { UnifiedSearchBlock } from '@/components/search/UnifiedSearchBlock';
import StudySpecialists from '@/pages/study/StudySpecialists';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePageSecondaryNav } from '@/hooks/usePageSecondaryNav';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  isMarketBrowseCategoryId,
  isMarketSectionId,
  MARKET_CAROUSEL_SECTION_IDS,
  parseMarketSectionParam,
  MARKET_CATEGORY_ICONS,
  marketCategoryLabelKey,
  type MarketPrimaryTabId,
  type MarketSectionId,
} from '@/lib/market-categories';
import type { MarketListingKind } from '@/lib/use-market-published-listings';
import {
  useMarketMyPublishedListings,
  useMarketPublishedListings,
} from '@/lib/use-market-published-listings';

const DEFAULT_SECTION: MarketPrimaryTabId = 'for-you';

function readListingKindFromParams(searchParams: URLSearchParams): MarketListingKind {
  return searchParams.get('kind') === 'service' ? 'service' : 'product';
}

function readSectionFromParams(searchParams: URLSearchParams): MarketSectionId {
  const fromUrl = parseMarketSectionParam(searchParams.get('section'));
  if (fromUrl && MARKET_CAROUSEL_SECTION_IDS.includes(fromUrl)) {
    return fromUrl;
  }
  return DEFAULT_SECTION;
}

export default function Market() {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { listings, loading: listingsLoading, error: listingsError, refetch: refetchListings } =
    useMarketPublishedListings();
  const {
    listings: myListings,
    loading: myListingsLoading,
    error: myListingsError,
    refetch: refetchMyListings,
  } = useMarketMyPublishedListings(profile?.id ?? null);
  const [postOpen, setPostOpen] = useState(false);
  const [section, setSection] = useState<MarketSectionId>(() => readSectionFromParams(searchParams));
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [listingKind, setListingKind] = useState<MarketListingKind>(() =>
    readListingKindFromParams(searchParams),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  const amountLocale = language === 'en' ? 'en-US' : language;

  const bumpListings = useCallback(() => {
    void refetchListings();
    void refetchMyListings();
  }, [refetchListings, refetchMyListings]);

  const noopBalance = useCallback(() => {}, []);

  const isSaved = section === 'saved';
  const isSelling = section === 'sell';
  const isJobs = section === 'jobs';
  const isForYou = section === 'for-you';
  const browseCategoryId = isMarketBrowseCategoryId(section) ? section : null;

  const sourceListings = isSelling ? myListings : listings;
  const sourceLoading = isSelling ? myListingsLoading : listingsLoading;
  const sourceError = isSelling ? myListingsError : listingsError;

  const showListingKindToggle = !inlineSearchOpen && !isJobs;

  const listingKindFilter: MarketListingKind | null = isJobs ? 'service' : listingKind;

  const filteredListings = useMemo(() => {
    return sourceListings.filter((listing) => {
      if (listingKindFilter && listing.listing_kind !== listingKindFilter) {
        return false;
      }
      if (searchDraft.trim()) {
        const needle = searchDraft.trim().toLowerCase();
        const haystack = `${listing.title} ${listing.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [isSelling, listingKindFilter, searchDraft, sourceListings]);

  const marketSecondaryNav = useMemo(
    () => ({
      loop: true,
      items: MARKET_CAROUSEL_SECTION_IDS.map((id) => ({
        id,
        label: t(marketCategoryLabelKey(id)),
        icon: MARKET_CATEGORY_ICONS[id],
        disabled: (id === 'sell' || id === 'saved') && !profile?.id,
      })),
      value: section,
      onChange: (value: string) => {
        if (!isMarketSectionId(value)) return;
        if ((value === 'sell' || value === 'saved') && !profile?.id) return;
        setSection(value);
      },
      fab: profile?.id
        ? {
            label: t('market.sellFabLabel'),
            ariaLabel: t('market.sellFabLabel'),
            onClick: () => {
              setSection('sell');
              setPostOpen(true);
            },
          }
        : null,
    }),
    [profile?.id, section, t],
  );
  usePageSecondaryNav(marketSecondaryNav);

  const emptyMessage = useMemo(() => {
    const servicesBrowse = listingKind === 'service' && !isSelling && !isSaved;
    if (isSaved) return t('market.sectionSavedEmpty');
    if (isSelling) {
      return listingKind === 'service' ? t('market.sellingEmptyServices') : t('market.sellingEmpty');
    }
    if (servicesBrowse) return t('market.sectionBrowseServicesEmpty');
    if (isForYou) return t('market.sectionForYouEmpty');
    if (section === 'local') return t('market.sectionLocalEmpty');
    if (isJobs) return t('market.sectionJobsEmpty');
    if (browseCategoryId) return t('market.sectionCategoryEmpty');
    return t('market.listingsEmpty');
  }, [browseCategoryId, isForYou, isJobs, isSaved, isSelling, listingKind, section, t]);

  const sectionTitle = t(marketCategoryLabelKey(section));

  useEffect(() => {
    const fromUrl = readSectionFromParams(searchParams);
    setSection((current) => (current === fromUrl ? current : fromUrl));
    const fromKind = readListingKindFromParams(searchParams);
    setListingKind((current) => (current === fromKind ? current : fromKind));
  }, [searchParams]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (section === DEFAULT_SECTION) {
        next.delete('section');
      } else {
        next.set('section', section);
      }
      if (listingKind === 'service') {
        next.set('kind', 'service');
      } else {
        next.delete('kind');
      }
      next.delete('entity');
      return next;
    }, { replace: true });
  }, [listingKind, section, setSearchParams]);

  useEffect(() => {
    if ((section === 'sell' || section === 'saved') && !profile?.id) {
      setSection(DEFAULT_SECTION);
    }
  }, [profile?.id, section]);

  const showListingsGrid = !inlineSearchOpen && !isJobs && !isSaved;

  return (
    <AppLayout>
      <div
        className="flex min-h-0 flex-col pb-28"
        data-build-key="marketPage"
        data-build-label="Marketplace page"
      >
        <header
          className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pb-3 pt-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
          data-build-key="marketHeader"
          data-build-label="Marketplace header"
        >
          <div className="flex items-center justify-between gap-2 px-3">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <h1 className="truncate text-xl font-display font-bold leading-none tracking-tight text-foreground">
                {t('market.title')}
              </h1>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setFiltersOpen(true)}
                data-build-key="marketFiltersButton"
                data-build-label="Open marketplace filters"
                aria-label={t('market.filtersTitle')}
              >
                <ListFilter className="h-4 w-4" aria-hidden />
              </Button>
              {showListingKindToggle ? (
                <MarketListingKindIconToggle
                  value={listingKind}
                  onChange={setListingKind}
                  productsLabel={t('market.filterProducts')}
                  servicesLabel={t('market.filterServices')}
                  groupLabel={t('market.listingKindToggleLabel')}
                />
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {profile?.id ? (
                <>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <Link
                    to="/agreements"
                    data-build-key="marketAgreementsLink"
                    data-build-label="Agreements link"
                    aria-label={t('common.agreements')}
                  >
                    <FileSignature className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <Link
                    to="/settings/wallet"
                    data-build-key="marketWalletLink"
                    data-build-label="Wallet link"
                    aria-label={t('market.walletShortcut')}
                  >
                    <Wallet className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setInlineSearchOpen((current) => {
                      const next = !current;
                      if (next) {
                        setInlineSearchQuery('');
                      }
                      return next;
                    });
                  }}
                  data-build-key="marketGlobalSearchLink"
                  data-build-label="Open global search"
                  aria-label={t('common.search')}
                >
                  <Search className="h-4 w-4" aria-hidden />
                </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-3 px-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={
                  listingKind === 'service'
                    ? t('market.searchBarPlaceholderServices')
                    : t('market.searchBarPlaceholder')
                }
                className="h-10 rounded-full border-border/70 bg-muted/40 pl-9 pr-3 text-sm"
                aria-label={
                  listingKind === 'service'
                    ? t('market.searchBarPlaceholderServices')
                    : t('market.searchBarPlaceholder')
                }
              />
            </div>
          </div>
        </header>

        {inlineSearchOpen ? (
          <div className="px-3 pt-3">
            <Card className="border-border/70 bg-card/95 p-3 shadow-sm">
              <UnifiedSearchBlock
                showTitle={false}
                syncUrlParams={false}
                initialTab="products"
                initialQuery={inlineSearchQuery}
              />
            </Card>
          </div>
        ) : null}

        <div className="flex-1 space-y-3 px-2 pt-3 sm:px-3" data-build-key="marketGridSection">
          {inlineSearchOpen ? null : (
            <>
              {!isForYou ? (
                <div className="px-1">
                  <h2 className="text-base font-semibold text-foreground">{sectionTitle}</h2>
                  {!isSelling && !isJobs && !isSaved && browseCategoryId ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('market.categoriesHint')}</p>
                  ) : null}
                </div>
              ) : null}

              {isJobs ? (
                <div className="px-1">
                  <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">{t('market.specialists.description')}</p>
                  </Card>
                  <div className="pt-3">
                    <StudySpecialists embedded />
                  </div>
                </div>
              ) : null}

              {isSaved ? (
                <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
                  {t('market.sectionSavedEmpty')}
                </Card>
              ) : null}

              {showListingsGrid ? (
                sourceLoading ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('market.listingsLoading')}</p>
                ) : sourceError ? (
                  <p className="px-2 py-6 text-center text-sm text-destructive">{t('market.listingsError')}</p>
                ) : sourceListings.length === 0 ? (
                  <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </Card>
                ) : filteredListings.length === 0 ? (
                  <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
                    {searchDraft.trim() ? t('market.listingsNoMatch') : emptyMessage}
                  </Card>
                ) : (
                  <ul className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
                    {filteredListings.map((listing) => (
                      <MarketListingCard
                        key={listing.id}
                        listing={listing}
                        buyerProfileId={profile?.id ?? null}
                        amountLocale={amountLocale}
                        t={t}
                        layout="marketplace"
                        onListingsChanged={bumpListings}
                        onBalanceChanged={noopBalance}
                      />
                    ))}
                  </ul>
                )
              ) : null}
            </>
          )}
        </div>

        {!user ? (
          <p className="px-4 pt-2 text-center text-xs text-muted-foreground">{t('market.signInToSell')}</p>
        ) : null}
      </div>

      <MarketFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen} t={t} />

      {profile?.id ? (
        <PostMarketListingDialog
          open={postOpen}
          onOpenChange={setPostOpen}
          sellerProfileId={profile.id}
          onCreated={bumpListings}
          dialogTitle={t('market.postOfferTitle')}
          dialogDescription={t('market.postOfferDescription')}
          titleLabel={t('market.postOfferFieldTitle')}
          descriptionLabel={t('market.postOfferFieldDescription')}
          priceLabel={t('market.postOfferFieldPrice')}
          priceHint={t('market.postOfferPriceHint')}
          submitLabel={t('market.postOfferSubmit')}
          submittingLabel={t('market.postOfferSubmitting')}
          cancelLabel={t('market.postOfferCancel')}
          titleRequired={t('market.postOfferTitleRequired')}
          priceRequired={t('market.postOfferPriceRequired')}
          saveError={t('market.postOfferSaveError')}
          quantityLabel={t('market.postOfferQuantityLabel')}
          quantityHint={t('market.postOfferQuantityHint')}
          quantityInvalid={t('market.postOfferQuantityInvalid')}
          kindLabel={t('market.postOfferKindLabel')}
          kindProduct={t('market.postOfferKindProduct')}
          kindService={t('market.postOfferKindService')}
          kindHint={t('market.postOfferKindHint')}
        />
      ) : null}
    </AppLayout>
  );
}
