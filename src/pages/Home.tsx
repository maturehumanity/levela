import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LevelaScore } from '@/components/ui/LevelaScore';
import { ChatBar } from '@/components/ui/chat-bar';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import { type PillarId, getPillarShortName } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, PlusCircle, Star, ThumbsUp, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

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

export default function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (profile?.id) {
      setOptimisticLikeStates({});
      fetchData();
      const cleanup = subscribeToPosts();
      return cleanup;
    }
  }, [profile?.id]);

  const normalizePost = (raw: any): Post => ({
    id: raw.id,
    content: raw.content,
    created_at: raw.created_at,
    author_id: raw.author_id,
    is_edited: raw.is_edited,
    edited_at: raw.edited_at,
    syncStatus: raw.syncStatus ?? 'remote',
    author: raw.author as Post['author'],
  });

  const isMissingTableError = (error: any) => {
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
    return getPillarShortName(id);
  };

  const getDisplayName = (person?: { full_name?: string; username?: string }) => {
    return person?.full_name || person?.username || 'User';
  };

  const formatRelativeTime = (createdAt: string) => {
    const now = Date.now();
    const date = new Date(createdAt).getTime();
    const diffMs = now - date;

    if (diffMs < 60_000) return 'Just now';
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
        toast.message('Saved locally for now', {
          description: 'The live Posts table is not connected yet, so your post was saved on this device.',
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
          toast.message('Saved locally for now', {
            description: 'The Posts table is missing in Supabase, so this post was stored on this device.',
          });
          setPostContent('');
        } else {
          toast.error('Could not create post', {
            description: 'Please try again in a moment.',
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
        toast.success('Posted to your feed');
      }
    } catch (err) {
      console.error('Error creating post:', err);
      setPosts((prev) => mergePostsById(prev, [localPost]));
      setPostLikes((prev) => ({ ...prev, [localPost.id]: [] }));
      setPostComments((prev) => ({ ...prev, [localPost.id]: [] }));
      persistLocalPosts(mergePostsById(readStoredValue<Post[]>(getFeedStorageKey('posts'), []), [localPost]));
      toast.message('Saved locally for now', {
        description: 'Your post could not reach Supabase, but it was kept on this device.',
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
        toast.message('Saved locally for now', {
          description: 'Your like will stay visible on this device until the backend is available.',
        });
      } else {
        toast.error('Could not save like', {
          description: 'Please try again in a moment.',
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
          toast.message('Saved locally for now', {
            description: 'Comments are staying on this device until the Posts tables are connected.',
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
          <div className="animate-pulse-soft text-muted-foreground">Loading...</div>
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
              Welcome back,
            </h1>
            <p className="text-lg text-muted-foreground">
              {profile?.full_name?.split(' ')[0] || 'Friend'}
            </p>
          </div>
          <Avatar
            className="w-12 h-12 cursor-pointer border-2 border-border"
            onClick={() => navigate('/profile')}
          >
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        {/* Create Post / What’s on your mind block */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-4 mb-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <textarea
                rows={3}
                className="flex-1 min-h-[96px] resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                placeholder={`What’s on your mind, ${profile?.full_name?.split(' ')[0] || 'there'}?`}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    createPost();
                  }
                }}
              >
              </textarea>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Press <span className="font-medium text-foreground">Ctrl/⌘ + Enter</span> to post faster.
              </p>
              <Button size="sm" onClick={createPost} disabled={isPosting || !postContent.trim()}>
                {isPosting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
            <div className="flex items-center gap-6">
              <LevelaScore score={score.overall} size="md" showLabel={false} />
              <div className="flex-1">
                <h2 className="font-display font-bold text-xl text-foreground">
                  Your Levela Score
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  {score.totalEndorsements} total endorsements
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/profile')}
                  className="gap-2"
                >
                  View Details
                  <TrendingUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/search')}
          >
            <Users className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold text-foreground">Find People</h3>
            <p className="text-xs text-muted-foreground">Discover & endorse</p>
          </Card>
          <Card
            className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => navigate('/endorse')}
          >
            <PlusCircle className="w-8 h-8 text-accent mb-2" />
            <h3 className="font-semibold text-foreground">Endorse</h3>
            <p className="text-xs text-muted-foreground">Recognize someone</p>
          </Card>
        </motion.div>

        {/* User Posts Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {feedBackendUnavailable && (
            <Card className="p-4 mb-4 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm font-semibold text-foreground">Local feed mode</p>
              <p className="text-sm text-muted-foreground mt-1">
                The live Posts tables are not connected yet, so new posts and comments are saved on this device for now.
              </p>
            </Card>
          )}

          {posts.length === 0 ? (
            <Card className="p-6 mb-4 border-dashed border-2 border-border bg-background/60">
              <p className="text-sm text-muted-foreground">
                No posts yet. Share what&apos;s on your mind to start your feed.
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
                    <Card className="p-4">
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

                          <div className="mt-3 border-t border-border/70 pt-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`gap-2 ${hasLiked ? 'text-primary' : ''}`}
                                onClick={() => toggleLike(post.id)}
                                disabled={likingPostId === post.id}
                              >
                                <ThumbsUp className={`w-4 h-4 ${hasLiked ? 'fill-primary' : ''}`} />
                                {hasLiked ? 'Liked' : 'Like'}
                                {likeCount > 0 ? ` (${likeCount})` : ''}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => toggleComments(post.id)}
                              >
                                <MessageCircle className="w-4 h-4" />
                                Comment
                                {comments.length > 0 ? ` (${comments.length})` : ''}
                              </Button>
                            </div>
                          </div>

                          {isCommentsOpen && (
                            <div className="mt-3 space-y-3">
                              {comments.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No comments yet. Start the conversation.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {comments.map((comment) => (
                                    <div key={comment.id} className="rounded-lg bg-muted/40 p-3">
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
                                  className="w-full min-h-[68px] resize-none rounded-md border border-border p-2 text-sm"
                                  placeholder="Write a comment..."
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
                                  onClick={() => submitComment(post.id)}
                                  disabled={isSubmittingComment || !draftComment.trim()}
                                >
                                  {isSubmittingComment ? 'Posting...' : 'Post comment'}
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

        {/* Recent Endorsements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
          {recentEndorsements.length === 0 ? (
            <Card className="p-6 text-center">
              <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No endorsements yet</p>
              <p className="text-sm text-muted-foreground">
                Share your profile to start receiving endorsements
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
                          <span className="font-medium text-foreground">
                            {endorsement.endorser?.full_name || 'Someone'}
                          </span>
                          {' '}endorsed you on{' '}
                          <span className="font-medium text-primary">
                            {getPillarName(endorsement.pillar)}
                          </span>
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
      </div>

      {/* Community Chat */}
      <ChatBar />
    </AppLayout>
  );
}
