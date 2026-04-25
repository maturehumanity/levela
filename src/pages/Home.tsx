import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LevelaScore } from '@/components/ui/LevelaScore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import { type PillarId } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, BadgeX, ChevronDown, MessageCircle, Search, Star, ThumbsUp, TrendingUp, Vote } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { UnifiedSearchBlock } from '@/components/search/UnifiedSearchBlock';
import { Badge } from '@/components/ui/badge';
import { useDevelopmentStories } from '@/lib/use-development-stories';
const UserPageMenu = lazy(() => import('@/components/layout/UserPageMenu').then((module) => ({ default: module.UserPageMenu })));

interface RecentEndorsement {
  id: string;
  stars: number;
  pillar: PillarId;
  comment?: string;
  created_at: string;
  endorser: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  is_edited: boolean | null;
  edited_at?: string | null;
  syncStatus?: 'local' | 'remote';
  author: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface PostComment {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

type RawPostRecord = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  is_edited: boolean | null;
  edited_at?: string | null;
  syncStatus?: 'local' | 'remote';
  author: Post['author'];
};

type FeedQueryError = {
  code?: string;
  message?: string;
} | null | undefined;

export default function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [recentEndorsements, setRecentEndorsements] = useState<RecentEndorsement[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postLikes, setPostLikes] = useState<Record<string, string[]>>({});
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null);
  const [feedBackendUnavailable, setFeedBackendUnavailable] = useState(false);
  const [optimisticLikeStates, setOptimisticLikeStates] = useState<Record<string, boolean>>({});
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isInlineSearchOpen, setIsInlineSearchOpen] = useState(false);
  const [homeTab, setHomeTab] = useState<'all' | 'favourite' | 'stories'>('all');
  const [storyGroupTab, setStoryGroupTab] = useState<'development' | 'suggestions'>('development');
  const [storySectionFilter, setStorySectionFilter] = useState<string>('all');
  const [storyAreaFilter, setStoryAreaFilter] = useState<string>('all');
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const { stories: developmentStories, loading: storiesLoading } = useDevelopmentStories();
  const postTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canPost = postContent.trim().length > 0;
  useEffect(() => {
    if (profile?.id) {
      setOptimisticLikeStates({});
      fetchData();
      const cleanup = subscribeToPosts();
      return cleanup;
    }
  }, [profile?.id]);

  useEffect(() => {
    const textarea = postTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [postContent]);

  const normalizePost = (raw: RawPostRecord): Post => ({
    id: raw.id,
    content: raw.content,
    created_at: raw.created_at,
    author_id: raw.author_id,
    is_edited: raw.is_edited,
    edited_at: raw.edited_at,
    syncStatus: raw.syncStatus ?? 'remote',
    author: raw.author as Post['author'],
  });

  const isMissingTableError = (error: FeedQueryError) => {
    return error?.code === 'PGRST205' || /could not find the table|schema cache/i.test(error?.message || '');
  };

  const getFeedStorageKey = (kind: 'posts' | 'likes' | 'comments') => {
    return profile?.id ? `levela-home-${kind}:${profile.id}` : `levela-home-${kind}:anonymous`;
  };

  const readStoredValue = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const writeStoredValue = (key: string, value: unknown) => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota and serialization errors.
    }
  };

  const mergePostsById = (existingPosts: Post[], incomingPosts: Post[]) => {
    const merged = new Map<string, Post>();

    existingPosts.forEach((post) => {
      merged.set(post.id, post);
    });

    incomingPosts.forEach((post) => {
      merged.set(post.id, post);
    });

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  };

  const hydrateLocalFallbackData = () => {
    const localPosts = readStoredValue<Post[]>(getFeedStorageKey('posts'), []);
    const localLikes = readStoredValue<Record<string, string[]>>(getFeedStorageKey('likes'), {});
    const localComments = readStoredValue<Record<string, PostComment[]>>(getFeedStorageKey('comments'), {});

    if (localPosts.length > 0) {
      setPosts((prev) => mergePostsById(prev, localPosts));
    }

    if (Object.keys(localLikes).length > 0) {
      setPostLikes((prev) => ({ ...prev, ...localLikes }));
    }

    if (Object.keys(localComments).length > 0) {
      setPostComments((prev) => ({ ...prev, ...localComments }));
    }
  };

  const persistLocalPosts = (nextPosts: Post[]) => {
    const localPosts = nextPosts.filter((post) => post.syncStatus === 'local');
    writeStoredValue(getFeedStorageKey('posts'), localPosts);
  };

  const persistLocalLikes = (nextLikes: Record<string, string[]>) => {
    writeStoredValue(getFeedStorageKey('likes'), nextLikes);
  };

  const persistLocalComments = (nextComments: Record<string, PostComment[]>) => {
    writeStoredValue(getFeedStorageKey('comments'), nextComments);
  };

  const mergeFetchedLikeState = (
    current: Record<string, string[]>,
    fetched: Record<string, string[]>
  ) => {
    const next = { ...current };

    Object.entries(fetched).forEach(([postId, userIds]) => {
      if (!(postId in next)) {
        next[postId] = userIds;
      }
    });

    return next;
  };

  const mergeFetchedCommentState = (
    current: Record<string, PostComment[]>,
    fetched: Record<string, PostComment[]>
  ) => {
    const next = { ...current };

    Object.entries(fetched).forEach(([postId, comments]) => {
      if (!(postId in next)) {
        next[postId] = comments;
      }
    });

    return next;
  };

  const fetchPostInteractions = async (postIds: string[]) => {
    if (postIds.length === 0) {
      setPostLikes({});
      setPostComments({});
      return false;
    }

    const [{ data: likesData, error: likesError }, { data: commentsData, error: commentsError }] =
      await Promise.all([
        supabase
          .from('post_likes')
          .select('post_id, user_id')
          .in('post_id', postIds),
        supabase
          .from('post_comments')
          .select(`
            id,
            post_id,
            content,
            created_at,
            author_id,
            author:profiles!post_comments_author_id_fkey(id, username, full_name, avatar_url)
          `)
          .in('post_id', postIds)
          .order('created_at', { ascending: true }),
      ]);

    let backendUnavailable = false;

    if (likesError) {
      console.error('Error fetching post likes:', likesError);
      if (isMissingTableError(likesError)) {
        backendUnavailable = true;
      }
    } else {
      const nextLikes: Record<string, string[]> = {};
      (likesData || []).forEach((like) => {
        if (!nextLikes[like.post_id]) {
          nextLikes[like.post_id] = [];
        }
        nextLikes[like.post_id].push(like.user_id);
      });
      setPostLikes((prev) => mergeFetchedLikeState(prev, nextLikes));
    }

    if (commentsError) {
      console.error('Error fetching post comments:', commentsError);
      if (isMissingTableError(commentsError)) {
        backendUnavailable = true;
      }
    } else {
      const nextComments: Record<string, PostComment[]> = {};
      (commentsData || []).forEach((comment) => {
        if (!nextComments[comment.post_id]) {
          nextComments[comment.post_id] = [];
        }
        nextComments[comment.post_id].push({
          ...comment,
          author: comment.author as PostComment['author'],
        });
      });
      setPostComments((prev) => mergeFetchedCommentState(prev, nextComments));
    }

    return backendUnavailable;
  };

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setFeedBackendUnavailable(false);

    try {
      // Fetch endorsements for score
      const { data: endorsementData } = await supabase
        .from('endorsements')
        .select('*')
        .eq('endorsed_id', profile.id)
        .eq('is_hidden', false);

      if (endorsementData) {
        setEndorsements(endorsementData.map(e => ({
          ...e,
          pillar: e.pillar as PillarId,
        })));
      }

      // Fetch recent endorsements with endorser info
      const { data: recentData } = await supabase
        .from('endorsements')
        .select(`
          id,
          stars,
          pillar,
          comment,
          created_at,
          endorser:profiles!endorsements_endorser_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq('endorsed_id', profile.id)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentData) {
        setRecentEndorsements(recentData.map(e => ({
          ...e,
          pillar: e.pillar as PillarId,
          endorser: e.endorser as unknown as RecentEndorsement['endorser'],
        })));
      }

      // Fetch posts for feed
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          author_id,
          is_edited,
          edited_at,
          author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        if (isMissingTableError(postsError)) {
          setFeedBackendUnavailable(true);
          hydrateLocalFallbackData();
        }
      } else {
        const normalizedPosts = (postsData || []).map(normalizePost);
        setPosts((prev) => mergePostsById(prev, normalizedPosts));
        const interactionsUnavailable = await fetchPostInteractions(normalizedPosts.map((post) => post.id));
        if (!interactionsUnavailable) {
          setFeedBackendUnavailable(false);
        }
        hydrateLocalFallbackData();
      }
    } finally {
      setLoading(false);
    }
  };

  const score = calculateLevelaScore(endorsements);
  const showHomeGovernanceHub = Boolean(profile && profile.role !== 'guest');
  const showScoreCard = homeTab === 'all' || homeTab === 'favourite';
  const showComposer = homeTab === 'all';
  const showQuickActions = homeTab === 'all';
  const showPostsFeed = homeTab === 'all';
  const showRecentEndorsements = homeTab === 'all' || homeTab === 'favourite';
  const showDevelopmentStories = homeTab === 'stories';
  const sectionFilters = useMemo(() => Array.from(new Set(developmentStories.map((story) => story.section))), [developmentStories]);
  const areaFilters = useMemo(() => Array.from(new Set(developmentStories.map((story) => story.area))), [developmentStories]);
  const filteredStories = useMemo(() => {
    return developmentStories.filter((story) => {
      const matchesSection = storySectionFilter === 'all' || story.section === storySectionFilter;
      const matchesArea = storyAreaFilter === 'all' || story.area === storyAreaFilter;
      return matchesSection && matchesArea;
    });
  }, [developmentStories, storyAreaFilter, storySectionFilter]);
  const storyKindTab = storyGroupTab === 'suggestions' ? 'suggestion' : 'development';
  const visibleStories = useMemo(
    () => filteredStories.filter((story) => (story.storyKind ?? 'development') === storyKindTab),
    [filteredStories, storyKindTab],
  );
  useEffect(() => {
    if (visibleStories.length === 0) {
      setSelectedStoryId(null);
      return;
    }

    if (selectedStoryId && !visibleStories.some((story) => story.id === selectedStoryId)) {
      setSelectedStoryId(null);
    }
  }, [selectedStoryId, visibleStories]);

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPillarName = (id: PillarId) => {
    switch (id) {
      case 'education_skills':
        return t('pillars.educationShort');
      case 'culture_ethics':
        return t('pillars.cultureShort');
      case 'responsibility_reliability':
        return t('pillars.responsibilityShort');
      case 'environment_community':
        return t('pillars.communityShort');
      case 'economy_contribution':
        return t('pillars.economyShort');
      default:
        return id;
    }
  };

  const getDisplayName = (person?: { full_name?: string; username?: string }) => {
    return person?.full_name || person?.username || t('common.anonymousUser');
  };

  const formatRelativeTime = (createdAt: string) => {
    const now = Date.now();
    const date = new Date(createdAt).getTime();
    const diffMs = now - date;

    if (diffMs < 60_000) return t('home.justNow');
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h`;
    if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)}d`;

    return new Date(createdAt).toLocaleDateString();
  };

  const subscribeToPosts = () => {
    if (feedBackendUnavailable) {
      return () => undefined;
    }

    const channel = supabase
      .channel('home-posts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          supabase
            .from('posts')
            .select(`
              id,
              content,
              created_at,
              author_id,
              is_edited,
              edited_at,
              author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data, error }) => {
              if (error || !data) return;
              const normalized = normalizePost(data);
              setPosts((prev) => {
                return mergePostsById(prev, [normalized]);
              });
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createPost = async () => {
    if (!postContent.trim() || !profile?.id || isPosting) return;
    setIsPosting(true);

    const content = postContent.trim();
    const localPost: Post = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      created_at: new Date().toISOString(),
      author_id: profile.id,
      is_edited: false,
      edited_at: null,
      syncStatus: 'local',
      author: {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      },
    };

    try {
      if (feedBackendUnavailable) {
        setPosts((prev) => mergePostsById(prev, [localPost]));
        setPostLikes((prev) => ({ ...prev, [localPost.id]: [] }));
        setPostComments((prev) => ({ ...prev, [localPost.id]: [] }));
        persistLocalPosts(mergePostsById(readStoredValue<Post[]>(getFeedStorageKey('posts'), []), [localPost]));
        toast.message(t('home.savedLocallyPost'), {
          description: t('home.savedLocallyPostDescription'),
        });
        setPostContent('');
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: profile.id,
          content,
        })
        .select(`
          id,
          content,
          created_at,
          author_id,
          is_edited,
          edited_at,
          author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)
        `)
        .single();

      if (error) {
        console.error('Error creating post:', error);
        if (isMissingTableError(error)) {
          setFeedBackendUnavailable(true);
          setPosts((prev) => mergePostsById(prev, [localPost]));
          setPostLikes((prev) => ({ ...prev, [localPost.id]: [] }));
          setPostComments((prev) => ({ ...prev, [localPost.id]: [] }));
          persistLocalPosts(mergePostsById(readStoredValue<Post[]>(getFeedStorageKey('posts'), []), [localPost]));
          toast.message(t('home.savedLocallyPost'), {
            description: t('home.savedLocallyPostDescription'),
          });
          setPostContent('');
        } else {
          toast.error(t('home.couldNotCreatePost'), {
            description: t('common.tryAgainMoment'),
          });
        }
        return;
      }

      if (data) {
        const normalized = normalizePost(data);
        setPosts((prev) => mergePostsById(prev, [normalized]));
        setPostLikes(prev => ({ ...prev, [normalized.id]: [] }));
        setPostComments(prev => ({ ...prev, [normalized.id]: [] }));
        setPostContent('');
        toast.success(t('home.postedToFeed'));
      }
    } catch (err) {
      console.error('Error creating post:', err);
      setPosts((prev) => mergePostsById(prev, [localPost]));
      setPostLikes((prev) => ({ ...prev, [localPost.id]: [] }));
      setPostComments((prev) => ({ ...prev, [localPost.id]: [] }));
      persistLocalPosts(mergePostsById(readStoredValue<Post[]>(getFeedStorageKey('posts'), []), [localPost]));
      toast.message(t('home.savedLocallyPost'), {
        description: t('home.savedLocallyPostDescription'),
      });
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!profile?.id || likingPostId === postId) return;

    const likedByUsers = postLikes[postId] || [];
    const serverHasLiked = likedByUsers.includes(profile.id);
    const hasLiked = optimisticLikeStates[postId] ?? serverHasLiked;
    const updatedLikes = hasLiked
      ? likedByUsers.filter((userId) => userId !== profile.id)
      : [...likedByUsers, profile.id];
    const nextHasLiked = !hasLiked;

    setLikingPostId(postId);
    setOptimisticLikeStates((prev) => ({ ...prev, [postId]: nextHasLiked }));
    setPostLikes((prev) => {
      const next = { ...prev, [postId]: updatedLikes };
      if (feedBackendUnavailable) {
        persistLocalLikes(next);
      }
      return next;
    });

    if (feedBackendUnavailable) {
      setLikingPostId(null);
      return;
    }

    const query = supabase.from('post_likes');
    const { error } = hasLiked
      ? await query.delete().eq('post_id', postId).eq('user_id', profile.id)
      : await query.insert({
          post_id: postId,
          user_id: profile.id,
        });

    if (error) {
      console.error('Error toggling like:', error);
      if (error.code === '23505' || /duplicate key/i.test(error.message || '')) {
        setOptimisticLikeStates((prev) => ({
          ...prev,
          [postId]: true,
        }));
        setLikingPostId(null);
        return;
      }

      if (isMissingTableError(error)) {
        setFeedBackendUnavailable(true);
        const fallbackLikes = { ...postLikes, [postId]: updatedLikes };
        setOptimisticLikeStates((prev) => ({
          ...prev,
          [postId]: nextHasLiked,
        }));
        setPostLikes(fallbackLikes);
        persistLocalLikes(fallbackLikes);
        toast.message(t('home.savedLocallyPost'), {
          description: t('home.savedLocallyLikeDescription'),
        });
      } else {
        toast.error(t('home.couldNotSaveLike'), {
          description: t('common.tryAgainMoment'),
        });
      }
    } else {
      setOptimisticLikeStates((prev) => ({
        ...prev,
        [postId]: nextHasLiked,
      }));
    }

    setLikingPostId(null);
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const submitComment = async (postId: string) => {
    if (!profile?.id || submittingCommentPostId === postId) return;
    const content = commentDrafts[postId]?.trim();
    if (!content) return;

    setSubmittingCommentPostId(postId);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: profile.id,
          content,
        })
        .select(`
          id,
          post_id,
          content,
          created_at,
          author_id,
          author:profiles!post_comments_author_id_fkey(id, username, full_name, avatar_url)
        `)
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        if (isMissingTableError(error)) {
          setFeedBackendUnavailable(true);
          const localComment: PostComment = {
            id: `local-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            post_id: postId,
            content,
            created_at: new Date().toISOString(),
            author_id: profile.id,
            author: {
              id: profile.id,
              username: profile.username,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
            },
          };

          setPostComments((prev) => {
            const updated = {
              ...prev,
              [postId]: [...(prev[postId] || []), localComment],
            };
            persistLocalComments(updated);
            return updated;
          });
          setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
          setExpandedComments((prev) => ({ ...prev, [postId]: true }));
          toast.message(t('home.savedLocallyPost'), {
            description: t('home.savedLocallyCommentDescription'),
          });
        }
        return;
      }

      if (data) {
        setPostComments((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), {
            ...data,
            author: data.author as PostComment['author'],
          }],
        }));
        setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
        setExpandedComments((prev) => ({ ...prev, [postId]: true }));
      }
    } catch (err) {
      console.error('Error creating comment:', err);
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse-soft text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t('home.welcomeUser', { name: profile?.full_name?.split(' ')[0] || t('home.friend') })}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-lg text-muted-foreground">
              <span>{t('home.worldCitizen')}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full',
                        profile?.is_verified
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
                          : 'bg-muted text-muted-foreground',
                      )}
                      aria-label={profile?.is_verified ? t('home.verifiedBadge') : t('home.unverifiedBadge')}
                    >
                      {profile?.is_verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <BadgeX className="h-3.5 w-3.5" />}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {profile?.is_verified ? t('home.userIsVerified') : t('home.userIsUnverified')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full border border-border/60 bg-card/60"
              onClick={() => setIsInlineSearchOpen((prev) => !prev)}
              aria-label={t('home.openSearch')}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Suspense fallback={<div className="h-10 w-10 rounded-full border border-border/60 bg-card/60" />}><UserPageMenu /></Suspense>
          </div>
        </motion.div>

        <Tabs
          value={homeTab}
          onValueChange={(value) => {
            if (value === 'all' || value === 'favourite' || value === 'stories') {
              setHomeTab(value);
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-3 bg-muted/80 p-1">
            <TabsTrigger
              value="all"
              className="rounded-xl text-base text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="favourite"
              className="rounded-xl text-base text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold"
            >
              Favourite
            </TabsTrigger>
            <TabsTrigger
              value="stories"
              title="Requests and implemented outcomes, documented for ecosystem transparency."
              className="rounded-xl text-base text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold"
            >
              Stories
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Score Card */}
        {showScoreCard ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-border/70 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md sm:p-6">
              <div className="flex items-center gap-4 sm:gap-6">
                <LevelaScore score={score.overall} size="md" showLabel={false} />
                <div className="flex-1">
                  <h2 className="font-display font-bold text-xl text-foreground">
                    {t('home.yourLevelaScore')}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t('home.totalEndorsements', { count: score.totalEndorsements })}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/profile')}
                    className="gap-2 rounded-xl border-border/70 bg-background/75 shadow-sm hover:bg-background"
                  >
                    {t('home.viewDetails')}
                    <TrendingUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* Create Post / What’s on your mind block */}
        {showComposer ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card
              className={`p-3 transition-all duration-200 sm:p-4 ${
                isComposerFocused
                  ? 'border-primary/20 shadow-md shadow-primary/10 -translate-y-0.5'
                  : 'border-border/80 shadow-none'
              }`}
            >
              <div className="flex items-start gap-2.5 sm:gap-3">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 items-end gap-2 sm:gap-3">
                  <textarea
                    ref={postTextareaRef}
                    rows={1}
                    className={`min-h-[44px] flex-1 overflow-hidden resize-none rounded-2xl border px-3 py-2.5 text-sm leading-6 text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10 sm:px-4 sm:py-3 ${
                      canPost
                        ? 'border-primary/30 bg-primary/5 shadow-sm'
                        : 'border-border bg-background'
                    }`}
                    placeholder={t('home.whatsOnYourMind', { name: profile?.full_name?.split(' ')[0] || 'there' })}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    onFocus={() => setIsComposerFocused(true)}
                    onBlur={() => setIsComposerFocused(false)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        createPost();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className={`h-11 shrink-0 rounded-2xl px-4 transition-all sm:px-5 disabled:border disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 ${
                      canPost
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md'
                        : ''
                    }`}
                    onClick={createPost}
                    disabled={isPosting || !canPost}
                  >
                    {isPosting ? t('home.posting') : t('home.post')}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {isInlineSearchOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Card className="border-border/70 bg-card/95 p-4 shadow-sm sm:p-5">
              <UnifiedSearchBlock showTitle={false} syncUrlParams={false} />
            </Card>
          </motion.div>
        ) : null}

        {/* Quick Actions */}
        {showHomeGovernanceHub && showQuickActions ? (
          <motion.div
            className={cn('grid gap-3', 'grid-cols-1')}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card
              className="cursor-pointer border-border/70 bg-card/95 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
              onClick={() => navigate('/governance')}
            >
              <Vote className="mb-2 w-8 h-8 text-primary" />
              <h3 className="font-semibold text-foreground">{t('home.governanceHub')}</h3>
              <p className="text-xs text-muted-foreground">{t('home.governanceHubDescription')}</p>
            </Card>
          </motion.div>
        ) : null}

        {/* User Posts Feed */}
        {showPostsFeed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
          {feedBackendUnavailable && (
            <Card className="mb-4 border-amber-500/25 bg-amber-500/5 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">{t('home.localFeedModeTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('home.localFeedModeDescription')}
              </p>
            </Card>
          )}

          {posts.length === 0 ? (
            <Card className="mb-4 border-2 border-dashed border-border/70 bg-card/70 p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">
                {t('home.noPostsYet')}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {posts.map((post, index) => {
                const likes = postLikes[post.id] || [];
                const comments = postComments[post.id] || [];
                const serverHasLiked = profile?.id ? likes.includes(profile.id) : false;
                const hasLiked = optimisticLikeStates[post.id] ?? serverHasLiked;
                const likeCountDelta = hasLiked === serverHasLiked ? 0 : hasLiked ? 1 : -1;
                const likeCount = Math.max(0, likes.length + likeCountDelta);
                const isCommentsOpen = !!expandedComments[post.id];
                const draftComment = commentDrafts[post.id] || '';
                const isSubmittingComment = submittingCommentPostId === post.id;

                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.04 }}
                  >
                    <Card className="border-border/70 bg-card/95 p-4 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={post.author?.avatar_url || undefined} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                            {getInitials(post.author?.full_name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {getDisplayName(post.author)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(post.created_at)}
                              </p>
                            </div>
                          </div>

                          <p className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words">
                            {post.content}
                          </p>

                          <div className="mt-3 border-t border-border/60 pt-2.5">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`gap-2 rounded-xl px-3 ${hasLiked ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
                                onClick={() => toggleLike(post.id)}
                                disabled={likingPostId === post.id}
                              >
                                <ThumbsUp className={`w-4 h-4 ${hasLiked ? 'fill-primary' : ''}`} />
                                {hasLiked ? t('home.liked') : t('home.like')}
                                {likeCount > 0 ? ` (${likeCount})` : ''}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 rounded-xl px-3 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                onClick={() => toggleComments(post.id)}
                              >
                                <MessageCircle className="w-4 h-4" />
                                {t('home.comment')}
                                {comments.length > 0 ? ` (${comments.length})` : ''}
                              </Button>
                            </div>
                          </div>

                          {isCommentsOpen && (
                            <div className="mt-3 space-y-3">
                              {comments.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {t('home.noCommentsYet')}
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {comments.map((comment) => (
                                    <div key={comment.id} className="rounded-2xl border border-border/50 bg-muted/35 p-3 shadow-sm">
                                      <p className="text-xs font-medium text-foreground">
                                        {getDisplayName(comment.author)}
                                      </p>
                                      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
                                        {comment.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <textarea
                                  className="min-h-[68px] w-full resize-none rounded-2xl border border-border/70 bg-background/90 p-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                  placeholder={t('home.writeComment')}
                                  value={draftComment}
                                  onChange={(event) =>
                                    setCommentDrafts((prev) => ({
                                      ...prev,
                                      [post.id]: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  className="rounded-xl px-4"
                                  onClick={() => submitComment(post.id)}
                                  disabled={isSubmittingComment || !draftComment.trim()}
                                >
                                  {isSubmittingComment ? t('home.posting') : t('home.postComment')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
          </motion.div>
        ) : null}

        {showDevelopmentStories ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={storyGroupTab === 'development' ? 'default' : 'outline'}
                  onClick={() => setStoryGroupTab('development')}
                  className="h-8 rounded-full px-3"
                >
                  Development
                </Button>
                <Button
                  size="sm"
                  variant={storyGroupTab === 'suggestions' ? 'default' : 'outline'}
                  onClick={() => setStoryGroupTab('suggestions')}
                  className="h-8 rounded-full px-3"
                >
                  Suggestions
                </Button>
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-foreground"
                  >
                    Section
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <div className="pointer-events-none invisible absolute right-0 top-9 z-20 w-[min(88vw,220px)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border/70 bg-popover p-1 opacity-0 shadow-lg transition group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setStorySectionFilter('all')}
                      className={cn(
                        'block w-full rounded-lg px-3 py-2 text-left text-xs break-words whitespace-normal',
                        storySectionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      All sections
                    </button>
                    {sectionFilters.map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setStorySectionFilter(section)}
                        className={cn(
                          'mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs break-words whitespace-normal',
                          storySectionFilter === section ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                        )}
                      >
                        {section}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-foreground"
                  >
                    Area
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <div className="pointer-events-none invisible absolute right-0 top-9 z-20 w-[min(88vw,260px)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border/70 bg-popover p-1 opacity-0 shadow-lg transition group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setStoryAreaFilter('all')}
                      className={cn(
                        'block w-full rounded-lg px-3 py-2 text-left text-xs break-words whitespace-normal',
                        storyAreaFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      All areas
                    </button>
                    {areaFilters.map((area) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => setStoryAreaFilter(area)}
                        className={cn(
                          'mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs break-words whitespace-normal',
                          storyAreaFilter === area ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                        )}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {storiesLoading ? (
              <Card className="border-border/70 bg-card/95 p-4 text-sm text-muted-foreground">
                {t('common.loading')}
              </Card>
            ) : null}

            {!storiesLoading && visibleStories.length > 0 ? (
              <Card className="border-border/70 bg-card/95 p-2 shadow-sm">
                <ul className="divide-y divide-border/60">
                  {visibleStories.map((story) => (
                    <li key={story.id} className="py-1 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => setSelectedStoryId((prev) => (prev === story.id ? null : story.id))}
                        className={cn(
                          'group w-full rounded-lg border border-border/70 p-3 text-left shadow-sm transition-all',
                          'cursor-pointer bg-card/95 hover:border-border hover:shadow-md',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selectedStoryId === story.id && 'border-primary/40 bg-primary/5 shadow-md',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            •
                          </span>
                          <p className="text-sm font-semibold text-foreground">{story.title}</p>
                        </div>
                      </button>

                      {selectedStoryId === story.id ? (
                        <div className="mt-2 rounded-xl border border-border/60 bg-card p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{story.section}</Badge>
                            <Badge variant="outline">{story.area}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(story.requestedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{story.rephrasedDescription}</p>
                          <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original instruction</p>
                            <p className="mt-1 text-sm text-foreground">{story.originalInstruction}</p>
                          </div>
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created components and features</p>
                            <ul className="mt-1 space-y-1 text-sm text-foreground">
                              {story.createdFeatures.map((feature) => (
                                <li key={feature}>- {feature}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose and expected behavior</p>
                            <p className="mt-1 text-sm text-foreground">{story.expectedBehavior}</p>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {!storiesLoading && visibleStories.length === 0 ? (
              <Card className="border-2 border-dashed border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
                {storyGroupTab === 'suggestions'
                  ? 'No suggestion stories yet for the selected filters.'
                  : 'No stories match the selected filters.'}
              </Card>
            ) : null}
          </motion.div>
        ) : null}

        {/* Recent Endorsements */}
        {showRecentEndorsements ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
          <h2 className="text-lg font-semibold text-foreground mb-3">{t('home.recentActivity')}</h2>
          {recentEndorsements.length === 0 ? (
            <Card className="p-6 text-center">
              <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{t('home.noEndorsementsYet')}</p>
              <p className="text-sm text-muted-foreground">
                {t('home.shareYourProfile')}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentEndorsements.map((endorsement, index) => (
                <motion.div
                  key={endorsement.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={endorsement.endorser?.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                          {getInitials(endorsement.endorser?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          {t('home.endorsedYouOn', {
                            person: endorsement.endorser?.full_name || t('home.someone'),
                            pillar: getPillarName(endorsement.pillar),
                          })}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < endorsement.stars
                                  ? 'fill-accent text-accent'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                          {endorsement.comment && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              "{endorsement.comment}"
                            </p>
                          )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
          </motion.div>
        ) : null}
      </div>

    </AppLayout>
  );
}
