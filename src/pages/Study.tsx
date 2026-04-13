import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  ChevronUp,
  Coins,
  Clock3,
  FileText,
  Gavel,
  Globe,
  GraduationCap,
  Landmark,
  Leaf,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { ConstitutionReader } from '@/components/study/ConstitutionReader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { permissionListHasAny } from '@/lib/access-control';
import { CONSTITUTION_ARTICLE_BOOKMARK_PREFIX, CONSTITUTION_STUDY_SECTIONS } from '@/lib/constitution-study';
import {
  buildStudyAiExplanation,
  getFoundationMaterialsForDomain,
  FOUNDATION_STUDY_DOCUMENT_KEYS,
  filterStudyDocumentsByQuery,
  getFoundationCompletionMetrics,
  STUDY_PROPOSALS,
  STUDY_DOCUMENTS,
  type StudyCertificationStatus,
  type StudyDocument,
  type StudyMaterial,
  type StudyMaterialType,
} from '@/lib/study';
import { cn } from '@/lib/utils';

type StudyDomain = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: ComponentType<{ className?: string }>;
  availableNow: boolean;
  launchPath?: string;
};

const STUDY_PROGRESS_KEY = 'levela-study-progress-v2';
const STUDY_BOOKMARKS_KEY = 'levela-study-bookmarks-v1';
const STUDY_CERTIFICATION_KEY = 'levela-study-certification-v1';
const FOUNDATION_CERTIFICATION_ID = 'civic_foundations';
const DOMAIN_PROGRESS_RING_RADIUS = 11;
const DOMAIN_PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * DOMAIN_PROGRESS_RING_RADIUS;
const CONSTITUTION_ARTICLE_HEADING_PATTERN = /^##\s+(.+)$/;

const studyDomains: StudyDomain[] = [
  {
    id: 'constitution',
    titleKey: 'study.domains.constitution.title',
    descriptionKey: 'study.domains.constitution.description',
    icon: Landmark,
    availableNow: true,
  },
  {
    id: 'laws',
    titleKey: 'study.domains.laws.title',
    descriptionKey: 'study.domains.laws.description',
    icon: Gavel,
    availableNow: true,
    launchPath: '/law',
  },
  {
    id: 'citizenship',
    titleKey: 'study.domains.citizenship.title',
    descriptionKey: 'study.domains.citizenship.description',
    icon: ShieldCheck,
    availableNow: true,
    launchPath: '/terms',
  },
  {
    id: 'economy',
    titleKey: 'study.domains.economy.title',
    descriptionKey: 'study.domains.economy.description',
    icon: Coins,
    availableNow: true,
    launchPath: '/study?domain=economy',
  },
  {
    id: 'aiEthics',
    titleKey: 'study.domains.aiEthics.title',
    descriptionKey: 'study.domains.aiEthics.description',
    icon: Sparkles,
    availableNow: false,
  },
  {
    id: 'rights',
    titleKey: 'study.domains.rights.title',
    descriptionKey: 'study.domains.rights.description',
    icon: Scale,
    availableNow: false,
  },
  {
    id: 'environment',
    titleKey: 'study.domains.environment.title',
    descriptionKey: 'study.domains.environment.description',
    icon: Leaf,
    availableNow: false,
  },
  {
    id: 'cultureEducation',
    titleKey: 'study.domains.cultureEducation.title',
    descriptionKey: 'study.domains.cultureEducation.description',
    icon: GraduationCap,
    availableNow: false,
  },
  {
    id: 'judicial',
    titleKey: 'study.domains.judicial.title',
    descriptionKey: 'study.domains.judicial.description',
    icon: Building2,
    availableNow: false,
  },
  {
    id: 'proposals',
    titleKey: 'study.domains.proposals.title',
    descriptionKey: 'study.domains.proposals.description',
    icon: Globe,
    availableNow: false,
  },
];

const materialTypeIcons: Record<StudyMaterialType, ComponentType<{ className?: string }>> = {
  constitution: Landmark,
  summary: BookOpen,
  legalText: Scale,
  guide: FileText,
};

type ProgressRow = Database['public']['Tables']['study_progress']['Row'];
type BookmarkRow = Database['public']['Tables']['study_bookmarks']['Row'];
type CertificationRow = Database['public']['Tables']['study_certifications']['Row'];
type BookmarkTarget = {
  key: string;
  title: string;
};

function isMissingStudyBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('study_')
    || message.includes('monetary_policy_')
  );
}

function constitutionArticleHeading(markdown: string) {
  const line = markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .find((candidate) => CONSTITUTION_ARTICLE_HEADING_PATTERN.test(candidate.trim()));
  if (!line) return 'Constitution Article';
  const match = line.trim().match(CONSTITUTION_ARTICLE_HEADING_PATTERN);
  return match?.[1]?.trim() || 'Constitution Article';
}

function readLocalProgress() {
  if (typeof window === 'undefined') return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(STUDY_PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function readLocalBookmarks() {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(STUDY_BOOKMARKS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function readLocalCertificationStatus() {
  if (typeof window === 'undefined') return 'pending' as StudyCertificationStatus;
  try {
    const raw = window.localStorage.getItem(STUDY_CERTIFICATION_KEY);
    return (raw as StudyCertificationStatus) || 'pending';
  } catch {
    return 'pending';
  }
}

function persistLocalState(args: {
  progressByKey: Record<string, number>;
  bookmarks: Set<string>;
  certificationStatus: StudyCertificationStatus;
}) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(args.progressByKey));
    window.localStorage.setItem(STUDY_BOOKMARKS_KEY, JSON.stringify(Array.from(args.bookmarks)));
    window.localStorage.setItem(STUDY_CERTIFICATION_KEY, args.certificationStatus);
  } catch {
    // Ignore local persistence errors and keep the in-memory state.
  }
}

export default function Study() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const canReadLaw = permissionListHasAny(profile?.effective_permissions || [], ['law.read']);
  const [progressByKey, setProgressByKey] = useState<Record<string, number>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [certificationStatus, setCertificationStatus] = useState<StudyCertificationStatus>('pending');
  const [studyBackendUnavailable, setStudyBackendUnavailable] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [explainDocument, setExplainDocument] = useState<StudyDocument | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedDomain = params.get('domain');

    if (!requestedDomain || !studyDomains.some((domain) => domain.id === requestedDomain)) {
      setSelectedDomain('');
      return;
    }

    setSelectedDomain(requestedDomain);
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    const loadStudyState = async () => {
      if (!profile?.id) {
        if (cancelled) return;
        const localProgress = readLocalProgress();
        const localBookmarks = new Set(readLocalBookmarks());
        const localCertification = readLocalCertificationStatus();
        setProgressByKey(localProgress);
        setBookmarks(localBookmarks);
        setCertificationStatus(localCertification);
        return;
      }

      const progressQuery = supabase
        .from('study_progress')
        .select('*')
        .eq('profile_id', profile.id);
      const bookmarksQuery = supabase
        .from('study_bookmarks')
        .select('*')
        .eq('profile_id', profile.id);
      const certificationQuery = supabase
        .from('study_certifications')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('certification_key', FOUNDATION_CERTIFICATION_ID)
        .maybeSingle();

      const [progressResponse, bookmarksResponse, certificationResponse] = await Promise.all([
        progressQuery,
        bookmarksQuery,
        certificationQuery,
      ]);

      if (cancelled) return;

      if (
        isMissingStudyBackend(progressResponse.error)
        || isMissingStudyBackend(bookmarksResponse.error)
        || isMissingStudyBackend(certificationResponse.error)
      ) {
        setStudyBackendUnavailable(true);
        setProgressByKey(readLocalProgress());
        setBookmarks(new Set(readLocalBookmarks()));
        setCertificationStatus(readLocalCertificationStatus());
        return;
      }

      if (progressResponse.error || bookmarksResponse.error || certificationResponse.error) {
        console.error('Failed to load study state:', {
          progressError: progressResponse.error,
          bookmarksError: bookmarksResponse.error,
          certificationError: certificationResponse.error,
        });
        toast.error(t('study.errors.loadFailed'));
        setProgressByKey(readLocalProgress());
        setBookmarks(new Set(readLocalBookmarks()));
        setCertificationStatus(readLocalCertificationStatus());
        return;
      }

      const nextProgress = (progressResponse.data as ProgressRow[]).reduce<Record<string, number>>(
        (accumulator, row) => {
          accumulator[row.document_key] = row.progress_percent;
          return accumulator;
        },
        {},
      );
      const nextBookmarks = new Set((bookmarksResponse.data as BookmarkRow[]).map((row) => row.document_key));
      const nextCertification = ((certificationResponse.data as CertificationRow | null)?.status || 'pending') as StudyCertificationStatus;

      setProgressByKey(nextProgress);
      setBookmarks(nextBookmarks);
      setCertificationStatus(nextCertification);
    };

    void loadStudyState();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, t]);

  const toggleBookmark = async (target: BookmarkTarget) => {
    const nextBookmarks = new Set(bookmarks);
    const isBookmarked = nextBookmarks.has(target.key);

    if (isBookmarked) {
      nextBookmarks.delete(target.key);
    } else {
      nextBookmarks.add(target.key);
    }

    setBookmarks(nextBookmarks);
    persistLocalState({
      progressByKey,
      bookmarks: nextBookmarks,
      certificationStatus,
    });

    if (!profile?.id || studyBackendUnavailable) return;

    if (isBookmarked) {
      const { error } = await supabase
        .from('study_bookmarks')
        .delete()
        .eq('profile_id', profile.id)
        .eq('document_key', target.key);

      if (error) {
        console.error('Failed to remove bookmark:', error);
        toast.error(t('study.errors.bookmarkSaveFailed'));
      }
      return;
    }

    const { error } = await supabase
      .from('study_bookmarks')
      .insert({
        profile_id: profile.id,
        document_key: target.key,
        title: target.title,
      });

    if (error) {
      console.error('Failed to save bookmark:', error);
      toast.error(t('study.errors.bookmarkSaveFailed'));
    }
  };

  const handleOpenDomain = (domain: StudyDomain) => {
    if (!domain.availableNow) return;
    if (domain.id === 'laws' && !canReadLaw) return;

    if (selectedDomain === domain.id) {
      setSelectedDomain('');
      navigate('/study', { replace: true });
      return;
    }

    if (domain.id === 'constitution') {
      setSelectedDomain('constitution');
      navigate('/study?domain=constitution', { replace: true });
      return;
    }

    setSelectedDomain(domain.id);
  };

  const handleOpenMaterial = (material: StudyMaterial, isDisabled: boolean) => {
    if (isDisabled || !material.availableNow) return;

    if (material.domainId !== 'constitution') {
      navigate(material.route);
      return;
    }

    setSelectedDomain('constitution');
    navigate('/study?domain=constitution', { replace: true });
  };

  const completionMetrics = getFoundationCompletionMetrics(progressByKey);
  const foundationProgressPercent = completionMetrics.percent;
  const completedFoundationCount = completionMetrics.completed;
  const certificationLabelKey =
    certificationStatus === 'earned'
      ? 'study.progress.badgeEarned'
      : certificationStatus === 'eligible'
        ? 'study.progress.badgeEligible'
        : 'study.progress.badgePending';

  const recommendedNextDocumentKey =
    FOUNDATION_STUDY_DOCUMENT_KEYS.find((key) => (progressByKey[key] ?? 0) < 100) || 'constitution';

  const filteredDocuments = useMemo(
    () =>
      filterStudyDocumentsByQuery(
        STUDY_DOCUMENTS,
        searchQuery,
        (document) => t(document.titleKey),
        (document) => t(document.summaryKey),
      ),
    [searchQuery, t],
  );
  const hasSearchQuery = searchQuery.trim().length > 0;

  const constitutionArticleBookmarks = useMemo(
    () =>
      CONSTITUTION_STUDY_SECTIONS
        .filter((section) => section.kind === 'article')
        .map((section) => ({
          id: section.id,
          key: `${CONSTITUTION_ARTICLE_BOOKMARK_PREFIX}${section.id}`,
          title: constitutionArticleHeading(section.markdown),
        })),
    [],
  );
  const bookmarkedDocuments = STUDY_DOCUMENTS.filter((document) => bookmarks.has(document.key));
  const bookmarkedConstitutionArticles = constitutionArticleBookmarks.filter((article) => bookmarks.has(article.key));
  const selectedDomainData = studyDomains.find((domain) => domain.id === selectedDomain);
  const studyDomainIconMap = useMemo(
    () =>
      studyDomains.reduce<Record<string, ComponentType<{ className?: string }>>>((accumulator, domain) => {
        accumulator[domain.id] = domain.icon;
        return accumulator;
      }, {}),
    [],
  );
  const RecommendedIcon = studyDomainIconMap[recommendedNextDocumentKey] || BookOpen;
  const selectedFoundationMaterials = useMemo(() => {
    if (
      selectedDomain !== 'laws'
      && selectedDomain !== 'citizenship'
      && selectedDomain !== 'economy'
    ) {
      return [];
    }

    return getFoundationMaterialsForDomain(selectedDomain);
  }, [selectedDomain]);
  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
            {t('study.badge')}
          </Badge>
          {studyBackendUnavailable && (
            <p className="text-xs text-muted-foreground">{t('study.localMode')}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('study.searchTitle')}
              </h2>
            </div>
            <Input
              className="mt-3"
              placeholder={t('study.searchPlaceholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <div className="mt-4 space-y-3">
              {!hasSearchQuery ? null : filteredDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('study.noSearchResults')}</p>
              ) : (
                filteredDocuments.map((document) => {
                  const DocumentIcon = studyDomainIconMap[document.domainId] || BookOpen;
                  const isBookmarked = bookmarks.has(document.key);
                  const isCompleted = (progressByKey[document.key] ?? 0) >= 100;
                  const isDisabled = document.key === 'laws' && !canReadLaw;
                  const canOpenDocument = Boolean(document.route) && document.availableNow && !isDisabled;
                  return (
                    <Card
                      key={document.key}
                      className={cn(
                        'border-border/70 bg-background/60 p-4',
                        canOpenDocument && 'cursor-pointer hover:border-border hover:shadow-sm',
                      )}
                      onClick={() => canOpenDocument && document.route && navigate(document.route)}
                      onKeyDown={(event) => {
                        if (canOpenDocument && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          navigate(document.route!);
                        }
                      }}
                      role={canOpenDocument ? 'button' : undefined}
                      tabIndex={canOpenDocument ? 0 : undefined}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <DocumentIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{t(document.titleKey)}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{t(document.summaryKey)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={document.availableNow ? 'secondary' : 'outline'} className="rounded-full">
                            {document.availableNow ? t('study.availableNow') : t('study.comingSoon')}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {t('study.estimatedMinutes', { minutes: document.estimatedMinutes })}
                          </Badge>
                          {isCompleted && <Badge className="rounded-full">{t('study.markedComplete')}</Badge>}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            void toggleBookmark({ key: document.key, title: t(document.titleKey) });
                          }}
                          className="gap-2"
                        >
                          {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          {isBookmarked ? t('study.removeBookmark') : t('study.bookmark')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExplainDocument(document);
                          }}
                        >
                          {t('study.aiExplain')}
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid gap-3 md:grid-cols-2"
        >
          {studyDomains.map((domain, index) => {
            const Icon = domain.icon;
            const isFoundational = FOUNDATION_STUDY_DOCUMENT_KEYS.includes(
              domain.id as (typeof FOUNDATION_STUDY_DOCUMENT_KEYS)[number],
            );
            const domainProgressPercent = Math.max(0, Math.min(100, progressByKey[domain.id] ?? 0));
            const isDisabled = domain.id === 'laws' && !canReadLaw;
            const canOpenDomain = domain.availableNow && !isDisabled;
            const domainTitle = t(domain.titleKey);
            const domainDescription = t(domain.descriptionKey);

            return (
              <motion.div
                key={domain.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.02 }}
                className="space-y-3"
              >
                <Card
                  className={cn(
                    'group border-border/70 p-3 shadow-sm transition-all',
                    canOpenDomain
                      ? 'cursor-pointer bg-card/95 hover:border-border hover:shadow-md'
                      : 'bg-muted/20',
                    selectedDomain === domain.id && 'border-primary/40 bg-primary/5',
                    isDisabled && 'cursor-not-allowed opacity-80',
                  )}
                  onClick={() => canOpenDomain && handleOpenDomain(domain)}
                  onKeyDown={(event) => {
                    if (canOpenDomain && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handleOpenDomain(domain);
                    }
                  }}
                  role={canOpenDomain ? 'button' : undefined}
                  tabIndex={canOpenDomain ? 0 : undefined}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>

                    <p
                      className="min-w-0 w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm"
                      title={`${domainTitle} - ${domainDescription}`}
                    >
                      <span
                        className={cn(
                          'font-semibold text-muted-foreground transition-colors',
                          canOpenDomain && 'group-hover:text-foreground',
                          selectedDomain === domain.id && 'text-foreground',
                        )}
                      >
                        {domainTitle}
                      </span>
                      <span className="mx-1 text-muted-foreground/70">-</span>
                      <span className="text-muted-foreground">{domainDescription}</span>
                    </p>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isFoundational && (
                        <span
                          className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/80"
                          title={
                            domainProgressPercent >= 100
                              ? t('study.progress.completedVerified')
                              : t('study.progress.readProgress', { percent: domainProgressPercent })
                          }
                        >
                          <svg
                            viewBox="0 0 28 28"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <circle
                              cx="14"
                              cy="14"
                              r={DOMAIN_PROGRESS_RING_RADIUS}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-muted-foreground/30"
                            />
                            <circle
                              cx="14"
                              cy="14"
                              r={DOMAIN_PROGRESS_RING_RADIUS}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              className="text-primary"
                              strokeDasharray={DOMAIN_PROGRESS_RING_CIRCUMFERENCE}
                              strokeDashoffset={
                                DOMAIN_PROGRESS_RING_CIRCUMFERENCE
                                - (domainProgressPercent / 100) * DOMAIN_PROGRESS_RING_CIRCUMFERENCE
                              }
                              transform="rotate(-90 14 14)"
                            />
                          </svg>
                          {domainProgressPercent >= 100 && (
                            <Check className="absolute h-3 w-3 text-primary" />
                          )}
                        </span>
                      )}

                      {!domain.availableNow && (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/80"
                          title={t('study.comingSoon')}
                        >
                          <Clock3 className="h-4 w-4 text-muted-foreground" />
                        </span>
                      )}

                      {canOpenDomain && (
                        selectedDomain === domain.id
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isDisabled && (
                    <p className="mt-1 pl-12 text-xs text-muted-foreground">{t('study.lawAccessRequired')}</p>
                  )}
                </Card>

                {domain.id === 'constitution' && selectedDomain === 'constitution' && (
                  <ConstitutionReader
                    mode="articles"
                    bookmarkedKeys={bookmarks}
                    onToggleArticleBookmark={(articleId, articleHeading) => {
                      void toggleBookmark({
                        key: `${CONSTITUTION_ARTICLE_BOOKMARK_PREFIX}${articleId}`,
                        title: articleHeading,
                      });
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {selectedDomain !== 'constitution' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
          >
            <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('study.foundationLibraryTitle')}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('study.foundationLibraryDescription')}</p>

            {selectedFoundationMaterials.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t('study.comingSoon')}</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {selectedFoundationMaterials.map((material) => {
                  const MaterialIcon = materialTypeIcons[material.materialType] || BookOpen;
                  const isDisabled = material.domainId === 'laws' && !canReadLaw;
                  return (
                    <Card key={material.key} className="border-border/70 bg-background/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <MaterialIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{t(material.titleKey)}</h4>
                            <p className="mt-1 text-sm text-muted-foreground">{t(material.summaryKey)}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {t(`study.materialType.${material.materialType}`)}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={isDisabled || !material.availableNow}
                          onClick={() => handleOpenMaterial(material, isDisabled)}
                        >
                          {isDisabled ? t('study.lawAccessRequired') : t('study.openMaterial')}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('study.bookmarksTitle')}
              </h3>
            </div>
            {bookmarkedDocuments.length === 0 && bookmarkedConstitutionArticles.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('study.noBookmarks')}</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {bookmarkedDocuments.map((document) => {
                  const DocumentIcon = studyDomainIconMap[document.domainId] || BookOpen;
                  return (
                  <li key={document.key} className="group flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 transition-colors group-hover:text-foreground">
                      <DocumentIcon className="h-4 w-4 text-primary" />
                      {t(document.titleKey)}
                    </span>
                    <Button
                      variant="ghost"
                      className="group relative h-7 w-7 p-0 text-primary hover:bg-transparent hover:text-primary"
                      onClick={() => void toggleBookmark({ key: document.key, title: t(document.titleKey) })}
                      aria-label={t('study.removeBookmark')}
                    >
                      <span className="relative inline-flex h-4 w-4 items-center justify-center">
                        <Bookmark className="h-4 w-4" />
                        <X className="absolute h-2.5 w-2.5 text-red-400" />
                      </span>
                      <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md border border-border/70 bg-background/95 px-2 py-1 text-[11px] text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        {t('study.removeBookmark')}
                      </span>
                    </Button>
                  </li>
                  );
                })}
                {bookmarkedConstitutionArticles.map((article) => (
                  <li key={article.key} className="group flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 transition-colors group-hover:text-foreground">
                      <Landmark className="h-4 w-4 text-primary" />
                      {article.title}
                    </span>
                    <Button
                      variant="ghost"
                      className="group relative h-7 w-7 p-0 text-primary hover:bg-transparent hover:text-primary"
                      onClick={() => void toggleBookmark({ key: article.key, title: article.title })}
                      aria-label={t('study.removeBookmark')}
                    >
                      <span className="relative inline-flex h-4 w-4 items-center justify-center">
                        <Bookmark className="h-4 w-4" />
                        <X className="absolute h-2.5 w-2.5 text-red-400" />
                      </span>
                      <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md border border-border/70 bg-background/95 px-2 py-1 text-[11px] text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        {t('study.removeBookmark')}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {t('study.continueLearning')}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <RecommendedIcon className="h-4 w-4 text-primary" />
              <p className="text-base font-semibold text-foreground">
                {t(`study.domains.${recommendedNextDocumentKey}.title`)}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`study.domains.${recommendedNextDocumentKey}.description`)}
            </p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="grid gap-3 lg:grid-cols-2"
        >
          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('study.recentlyUpdated')}
              </h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              <li className="inline-flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                {t('study.updates.constitutionCore')}
              </li>
              <li className="inline-flex items-center gap-2">
                <Gavel className="h-4 w-4 text-primary" />
                {t('study.updates.lawLibrary')}
              </li>
              <li className="inline-flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                {t('study.updates.lumaMonetary')}
              </li>
            </ul>
          </Card>

          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('study.pendingVotes')}
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              {STUDY_PROPOSALS.map((proposal) => (
                <Card key={proposal.key} className="border-border/70 bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{t(proposal.titleKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(proposal.summaryKey)}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {t(`study.proposalStatus.${proposal.status}`)}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => navigate(proposal.route)}
                    >
                      {t('study.viewProposal')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </motion.div>

        {selectedDomainData?.id === 'economy' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
          >
            <Card className="border-border/70 bg-gradient-to-br from-emerald-500/10 via-card to-primary/5 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">{t('study.economyBriefingTitle')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('study.economyBriefingDescription')}</p>
              <ul className="mt-4 space-y-2 text-sm text-foreground/90">
                <li>{t('study.economyBriefingPoints.supply')}</li>
                <li>{t('study.economyBriefingPoints.guardrails')}</li>
                <li>{t('study.economyBriefingPoints.approval')}</li>
                <li>{t('study.economyBriefingPoints.audit')}</li>
              </ul>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <Card className="border-border/70 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('study.progress.constitutionProgress')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{foundationProgressPercent}%</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('study.progress.completedModules')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {completedFoundationCount}/{FOUNDATION_STUDY_DOCUMENT_KEYS.length}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('study.progress.knowledgeBadge')}
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BadgeCheck
                    className={cn(
                      'h-4 w-4',
                      certificationStatus !== 'pending' ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  {t(certificationLabelKey)}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <Dialog open={Boolean(explainDocument)} onOpenChange={(open) => !open && setExplainDocument(null)}>
        <DialogContent>
          {explainDocument && (
            <>
              <DialogHeader>
                <DialogTitle>{t('study.aiExplainTitle')}</DialogTitle>
                <DialogDescription>{t(explainDocument.titleKey)}</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-foreground/90">
                {buildStudyAiExplanation({
                  title: t(explainDocument.titleKey),
                  summary: t(explainDocument.summaryKey),
                  domainLabel: t(`study.domains.${explainDocument.domainId}.title`),
                  estimatedMinutes: explainDocument.estimatedMinutes,
                })}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
