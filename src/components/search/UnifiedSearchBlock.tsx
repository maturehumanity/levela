import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Building2, CheckCircle, Package, Search as SearchIcon, UserRound, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMarketPublishedListings } from '@/lib/use-market-published-listings';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  deleted_at?: string | null;
}

interface CompanyProfile {
  profile_id: string;
  business_name_normalized: string | null;
  profile: UserProfile;
}

interface UnifiedSearchBlockProps {
  showTitle?: boolean;
  syncUrlParams?: boolean;
  className?: string;
  initialQuery?: string;
  initialTab?: 'all' | 'people' | 'companies' | 'products' | 'services';
}

export function UnifiedSearchBlock({
  showTitle = true,
  syncUrlParams = true,
  className,
  initialQuery = '',
  initialTab = 'all',
}: UnifiedSearchBlockProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile: currentProfile } = useAuth();
  const { t } = useLanguage();
  const { listings } = useMarketPublishedListings();
  const [query, setQuery] = useState(() => (syncUrlParams ? searchParams.get('q') ?? '' : initialQuery));
  const [peopleResults, setPeopleResults] = useState<UserProfile[]>([]);
  const [companyResults, setCompanyResults] = useState<CompanyProfile[]>([]);
  const [directoryError, setDirectoryError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'all' | 'people' | 'companies' | 'products' | 'services'>(() => {
    if (!syncUrlParams) return initialTab;
    const incoming = searchParams.get('tab');
    return incoming === 'all' || incoming === 'people' || incoming === 'companies' || incoming === 'products' || incoming === 'services'
      ? incoming
      : 'all';
  });

  useEffect(() => {
    if (!syncUrlParams) return;

    const incomingTab = searchParams.get('tab');
    if (incomingTab === 'all' || incomingTab === 'people' || incomingTab === 'companies' || incomingTab === 'products' || incomingTab === 'services') {
      setTab(incomingTab);
    }
    const incomingQuery = searchParams.get('q');
    if (incomingQuery !== null && incomingQuery !== query) {
      setQuery(incomingQuery);
    }
  }, [query, searchParams, syncUrlParams]);

  useEffect(() => {
    if (!syncUrlParams) return;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (query.trim()) {
        next.set('q', query);
      } else {
        next.delete('q');
      }
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [query, setSearchParams, syncUrlParams, tab]);

  useEffect(() => {
    const searchDirectory = async () => {
      if (query.length < 2) {
        setPeopleResults([]);
        setCompanyResults([]);
        setDirectoryError(false);
        return;
      }

      setLoading(true);
      setDirectoryError(false);

      const [{ data: peopleData, error: peopleError }, { data: companiesData, error: companiesError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, is_verified, deleted_at')
          .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
          .neq('id', currentProfile?.id || '')
          .is('deleted_at', null)
          .limit(30),
        supabase
          .from('linked_accounts')
          .select(`
            linked_profile_id,
            business_name_normalized,
            relationship_type,
            linked:profiles!linked_accounts_linked_profile_id_fkey(id, username, full_name, avatar_url, is_verified, deleted_at)
          `)
          .eq('relationship_type', 'business')
          .limit(120),
      ]);

      if (peopleError || companiesError) {
        setDirectoryError(true);
        setPeopleResults([]);
        setCompanyResults([]);
        setLoading(false);
        return;
      }

      setPeopleResults((peopleData ?? []) as UserProfile[]);

      const normalizedQuery = query.trim().toLowerCase();
      const companyAccumulator = new Map<string, CompanyProfile>();
      (companiesData ?? []).forEach((row) => {
        const linked = row.linked;
        if (!linked || linked.deleted_at) return;
        if (linked.id === currentProfile?.id) return;
        if (companyAccumulator.has(linked.id)) return;
        const haystack = `${linked.full_name ?? ''} ${linked.username ?? ''} ${row.business_name_normalized ?? ''}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return;
        companyAccumulator.set(linked.id, {
          profile_id: linked.id,
          business_name_normalized: row.business_name_normalized,
          profile: {
            id: linked.id,
            full_name: linked.full_name,
            username: linked.username,
            avatar_url: linked.avatar_url,
            is_verified: linked.is_verified,
          },
        });
      });
      setCompanyResults(Array.from(companyAccumulator.values()));
      setLoading(false);
    };

    const debounce = setTimeout(searchDirectory, 250);
    return () => clearTimeout(debounce);
  }, [query, currentProfile?.id]);

  const matchingListings = useMemo(() => {
    if (query.length < 2) return [];
    const normalized = query.trim().toLowerCase();
    return listings.filter((listing) => {
      const haystack = `${listing.title} ${listing.description ?? ''} ${listing.profiles?.full_name ?? ''} ${listing.profiles?.username ?? ''}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [listings, query]);

  const productResults = useMemo(
    () => matchingListings.filter((listing) => listing.listing_kind === 'product').slice(0, 20),
    [matchingListings],
  );
  const serviceResults = useMemo(
    () => matchingListings.filter((listing) => listing.listing_kind === 'service').slice(0, 20),
    [matchingListings],
  );

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const priceLabel = (priceLumens: number) => {
    return `${(priceLumens / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Luma`;
  };

  const showPeople = tab === 'all' || tab === 'people';
  const showCompanies = tab === 'all' || tab === 'companies';
  const showProducts = tab === 'all' || tab === 'products';
  const showServices = tab === 'all' || tab === 'services';
  const hasAnyResults = peopleResults.length > 0 || companyResults.length > 0 || productResults.length > 0 || serviceResults.length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      {showTitle ? (
        <h1 className="text-2xl font-display font-bold text-foreground mb-4">
          {t('search.title')}
        </h1>
      ) : null}

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder={t('search.placeholderUnified')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === 'all' || value === 'people' || value === 'companies' || value === 'products' || value === 'services') {
            setTab(value);
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">{t('search.tabAll')}</TabsTrigger>
          <TabsTrigger value="people">{t('search.tabPeople')}</TabsTrigger>
          <TabsTrigger value="companies">{t('search.tabCompanies')}</TabsTrigger>
          <TabsTrigger value="products">{t('search.tabProducts')}</TabsTrigger>
          <TabsTrigger value="services">{t('search.tabServices')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {loading && (
          <p className="text-center text-muted-foreground animate-pulse-soft">
            {t('search.searching')}
          </p>
        )}

        {!loading && query.length >= 2 && directoryError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-muted-foreground">{t('search.directoryError')}</p>
          </motion.div>
        )}

        {!loading && query.length >= 2 && !directoryError && !hasAnyResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t('search.noResultsFound')}</p>
            <p className="text-sm text-muted-foreground">{t('search.tryDifferent')}</p>
          </motion.div>
        )}

        {query.length >= 2 && showPeople && peopleResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('search.tabPeople')}</h2>
            </div>
            {peopleResults.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {user.full_name || t('common.anonymousUser')}
                        </h3>
                        {user.is_verified && (
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </div>
                      {user.username && (
                        <p className="text-sm text-muted-foreground">
                          @{user.username}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/user/${user.id}`)}>
                        {t('search.viewProfile')}
                      </Button>
                      <Button size="sm" onClick={() => navigate(`/endorse/${user.id}`)}>
                        {t('common.endorse')}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {query.length >= 2 && showCompanies && companyResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('search.tabCompanies')}</h2>
            </div>
            {companyResults.map((company, index) => (
              <motion.div
                key={company.profile_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={company.profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(company.profile.full_name || company.business_name_normalized)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {company.profile.full_name || company.business_name_normalized || t('search.companyFallback')}
                        </h3>
                        {company.profile.is_verified && (
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {company.profile.username ? `@${company.profile.username}` : t('search.businessAccount')}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/user/${company.profile_id}`)}>
                      {t('search.viewProfile')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {query.length >= 2 && showProducts && productResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('search.tabProducts')}</h2>
            </div>
            {productResults.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{listing.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{listing.description || t('search.noDescription')}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{priceLabel(listing.price_lumens)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {listing.profiles?.full_name || listing.profiles?.username || t('search.sellerFallback')}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/market?entity=products')}>
                      {t('search.openInMarket')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {query.length >= 2 && showServices && serviceResults.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{t('search.tabServices')}</h2>
            </div>
            {serviceResults.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{listing.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{listing.description || t('search.noDescription')}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{priceLabel(listing.price_lumens)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {listing.profiles?.full_name || listing.profiles?.username || t('search.sellerFallback')}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/market?entity=services')}>
                      {t('search.openInMarket')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {query.length < 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t('search.startTypingUnified')}</p>
            <p className="text-sm text-muted-foreground">
              {t('search.descriptionUnified')}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
