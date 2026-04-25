import { FileSignature, Plus, Search, Wallet } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { MarketListingCard } from '@/components/market/MarketListingCard';
import { PostMarketListingDialog } from '@/components/market/PostMarketListingDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { UnifiedSearchBlock } from '@/components/search/UnifiedSearchBlock';
import StudySpecialists from '@/pages/study/StudySpecialists';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { MarketListingKind } from '@/lib/use-market-published-listings';
import {
  useMarketMyPublishedListings,
  useMarketPublishedListings,
} from '@/lib/use-market-published-listings';
import { specialistProfiles } from '@/lib/specialists';
import { cn } from '@/lib/utils';

type MarketTab = 'browse' | 'selling';
type MarketEntity = 'people' | 'companies' | 'products' | 'services';

type MarketProfileDirectoryItem = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
};

type MarketCompanyDirectoryItem = {
  profile: MarketProfileDirectoryItem;
  business_name_normalized: string | null;
};

export default function Market() {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
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
  const [entity, setEntity] = useState<MarketEntity>(() => {
    const value = searchParams.get('entity');
    return (
      value === 'people'
      || value === 'companies'
      || value === 'products'
      || value === 'services'
    )
      ? value
      : 'products'
    ;
  });
  const [tab, setTab] = useState<MarketTab>('browse');
  const [people, setPeople] = useState<MarketProfileDirectoryItem[]>([]);
  const [companies, setCompanies] = useState<MarketCompanyDirectoryItem[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState(false);
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [inlineSearchQuery, setInlineSearchQuery] = useState('');

  const amountLocale = language === 'en' ? 'en-US' : language;

  const bumpListings = useCallback(() => {
    void refetchListings();
    void refetchMyListings();
  }, [refetchListings, refetchMyListings]);

  const noopBalance = useCallback(() => {}, []);

  const sourceListings = tab === 'browse' ? listings : myListings;
  const sourceLoading = tab === 'browse' ? listingsLoading : myListingsLoading;
  const sourceError = tab === 'browse' ? listingsError : myListingsError;

  const listingKindFilter: MarketListingKind | null = entity === 'services'
    ? 'service'
    : entity === 'products'
      ? 'product'
      : null;

  const filteredListings = useMemo(() => {
    return sourceListings.filter((listing) => {
      if (listingKindFilter && listing.listing_kind !== listingKindFilter) return false;
      return true;
    });
  }, [sourceListings, listingKindFilter]);

  const filteredPeople = people;
  const filteredCompanies = companies;

  useEffect(() => {
    const value = searchParams.get('entity');
    if (value === 'people' || value === 'companies' || value === 'products' || value === 'services') {
      setEntity(value);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tab === 'selling' && (entity === 'people' || entity === 'companies')) {
      setEntity('products');
    }
  }, [entity, tab]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('entity', entity);
      return next;
    }, { replace: true });
  }, [entity, setSearchParams]);

  useEffect(() => {
    if (tab !== 'browse' || (entity !== 'people' && entity !== 'companies')) return;

    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError(false);

    const loadDirectory = async () => {
      const [{ data: peopleData, error: peopleError }, { data: linkedData, error: linkedError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, is_verified')
          .is('deleted_at', null)
          .order('full_name', { ascending: true })
          .limit(200),
        supabase
          .from('linked_accounts')
          .select(`
            linked_profile_id,
            business_name_normalized,
            relationship_type,
            linked:profiles!linked_accounts_linked_profile_id_fkey(id, full_name, username, avatar_url, is_verified, deleted_at)
          `)
          .eq('relationship_type', 'business')
          .limit(200),
      ]);

      if (cancelled) return;

      if (peopleError || linkedError) {
        console.error('Failed to load market directory data:', { peopleError, linkedError });
        setDirectoryError(true);
        setPeople([]);
        setCompanies([]);
        setDirectoryLoading(false);
        return;
      }

      const currentProfileId = profile?.id ?? null;
      const peopleRows = (peopleData ?? []).filter((row) => row.id !== currentProfileId);
      setPeople(peopleRows);

      const companiesById = new Map<string, MarketCompanyDirectoryItem>();
      (linkedData ?? []).forEach((row) => {
        const linked = row.linked;
        if (!linked || linked.deleted_at) return;
        if (linked.id === currentProfileId) return;
        if (companiesById.has(linked.id)) return;
        companiesById.set(linked.id, {
          profile: {
            id: linked.id,
            full_name: linked.full_name,
            username: linked.username,
            avatar_url: linked.avatar_url,
            is_verified: linked.is_verified,
          },
          business_name_normalized: row.business_name_normalized,
        });
      });
      setCompanies(Array.from(companiesById.values()));
      setDirectoryLoading(false);
    };

    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [entity, profile?.id, tab]);

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((chunk) => chunk[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const marketEntityToSearchTab = (value: MarketEntity): 'all' | 'people' | 'companies' | 'products' | 'services' => {
    if (value === 'people' || value === 'companies' || value === 'products' || value === 'services') return value;
    return 'all';
  };

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
          <div className="flex items-start justify-between gap-2 px-3">
            <div className="min-w-0">
              <h1 className="text-xl font-display font-bold tracking-tight text-foreground">{t('market.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('market.mobileTagline')}</p>
            </div>
            {profile?.id ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-2" asChild>
                  <Link to="/agreements" data-build-key="marketAgreementsLink" data-build-label="Agreements link">
                    <FileSignature className="h-4 w-4" aria-hidden />
                    <span className="max-[380px]:sr-only">{t('common.agreements')}</span>
                  </Link>
                </Button>
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-2" asChild>
                  <Link to="/settings/luma-wallet" data-build-key="marketWalletLink" data-build-label="Luma wallet link">
                    <Wallet className="h-4 w-4" aria-hidden />
                    <span className="max-[380px]:sr-only">{t('market.walletShortcut')}</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
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
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-3 px-3">
            <Tabs
              value={tab}
              onValueChange={(v) => {
                if (v === 'browse' || v === 'selling') setTab(v);
              }}
              className="w-full"
            >
              <TabsList
                className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/80 p-1"
                data-build-key="marketTabs"
                data-build-label="Browse or selling tabs"
              >
                <TabsTrigger value="browse" className="rounded-lg text-sm">
                  {t('market.tabBrowse')}
                </TabsTrigger>
                <TabsTrigger value="selling" className="rounded-lg text-sm" disabled={!profile?.id}>
                  {t('market.tabSelling')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={entity} onValueChange={(value) => {
              if (value === 'people' || value === 'companies' || value === 'products' || value === 'services') {
                setEntity(value);
              }
            }}>
              <TabsList className="grid h-11 w-full grid-cols-4 rounded-xl bg-muted/80 p-1">
                <TabsTrigger value="people" className="rounded-lg text-xs md:text-sm" disabled={tab === 'selling'}>
                  {t('market.filterPeople')}
                </TabsTrigger>
                <TabsTrigger value="companies" className="rounded-lg text-xs md:text-sm" disabled={tab === 'selling'}>
                  {t('market.filterCompanies')}
                </TabsTrigger>
                <TabsTrigger value="products" className="rounded-lg text-xs md:text-sm">
                  {t('market.filterProducts')}
                </TabsTrigger>
                <TabsTrigger value="services" className="rounded-lg text-xs md:text-sm">
                  {t('market.filterServices')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        {entity === 'services' && tab === 'browse' && (
          <div className="px-3 pt-3">
            <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {t('market.specialists.title')}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t('market.specialists.description')}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInlineSearchQuery('specialist');
                    setInlineSearchOpen(true);
                  }}
                >
                  {t('market.specialists.cta')}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t('market.specialists.availableDomains', {
                  domains: specialistProfiles
                    .filter((specialist) => specialist.marketEligible)
                    .map((specialist) => specialist.name)
                    .join(', '),
                })}
              </p>
            </Card>
          </div>
        )}

        {inlineSearchOpen ? (
          <div className="px-3 pt-3">
            <Card className="border-border/70 bg-card/95 p-3 shadow-sm">
              <UnifiedSearchBlock
                showTitle={false}
                syncUrlParams={false}
                initialTab={marketEntityToSearchTab(entity)}
                initialQuery={inlineSearchQuery}
              />
            </Card>
          </div>
        ) : null}

        <div className="flex-1 px-2 pt-3 sm:px-3" data-build-key="marketGridSection">
          {inlineSearchOpen ? null : (entity === 'services' && tab === 'browse' ? (
            <StudySpecialists embedded />
          ) : (entity === 'people' || entity === 'companies') ? (
            directoryLoading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('market.directoryLoading')}</p>
            ) : directoryError ? (
              <p className="px-2 py-6 text-center text-sm text-destructive">{t('market.directoryError')}</p>
            ) : entity === 'people' ? (
              filteredPeople.length === 0 ? (
                <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
                  {t('market.peopleEmpty')}
                </Card>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {filteredPeople.map((person) => (
                    <li key={person.id}>
                      <Card className="border-border/70 bg-card/95 p-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={person.avatar_url || undefined} />
                            <AvatarFallback>{getInitials(person.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{person.full_name || t('common.anonymousUser')}</p>
                            <p className="truncate text-xs text-muted-foreground">{person.username ? `@${person.username}` : t('market.member')}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/user/${person.id}`)}>
                              {t('market.view')}
                            </Button>
                            <Button size="sm" onClick={() => navigate(`/endorse/${person.id}`)}>
                              {t('common.endorse')}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              filteredCompanies.length === 0 ? (
                <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
                  {t('market.companiesEmpty')}
                </Card>
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {filteredCompanies.map((company) => (
                    <li key={company.profile.id}>
                      <Card className="border-border/70 bg-card/95 p-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={company.profile.avatar_url || undefined} />
                            <AvatarFallback>
                              {getInitials(company.profile.full_name || company.business_name_normalized)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {company.profile.full_name || company.business_name_normalized || t('market.company')}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {company.profile.username ? `@${company.profile.username}` : t('market.businessAccount')}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/user/${company.profile.id}`)}>
                            {t('market.view')}
                          </Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )
            )
          ) : sourceLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('market.listingsLoading')}</p>
          ) : sourceError ? (
            <p className="px-2 py-6 text-center text-sm text-destructive">{t('market.listingsError')}</p>
          ) : sourceListings.length === 0 ? (
            <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
              {tab === 'selling' ? t('market.sellingEmpty') : t('market.listingsEmpty')}
            </Card>
          ) : filteredListings.length === 0 ? (
            <Card className="mx-1 border-border/60 bg-muted/15 p-8 text-center text-sm text-muted-foreground">
              {t('market.listingsNoMatch')}
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
          ))}
        </div>

        {!user ? (
          <p className="px-4 pt-2 text-center text-xs text-muted-foreground">{t('market.signInToSell')}</p>
        ) : null}
      </div>

      {profile?.id ? (
        <>
          <Button
            type="button"
            size="icon"
            className={cn(
              'fixed z-[60] h-14 w-14 rounded-full shadow-lg',
              'bottom-[calc(5rem+env(safe-area-inset-bottom,0px)+8px)] right-4 sm:right-6',
            )}
            onClick={() => setPostOpen(true)}
            aria-label={t('market.sellFabLabel')}
            data-build-key="marketSellFab"
            data-build-label="Sell floating button"
          >
            <Plus className="h-7 w-7" aria-hidden />
          </Button>

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
        </>
      ) : null}
    </AppLayout>
  );
}
