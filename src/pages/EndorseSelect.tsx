import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Star, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export default function EndorseSelect() {
  const navigate = useNavigate();
  const { profile: currentProfile } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecentUsers();
  }, [currentProfile?.id]);

  const fetchRecentUsers = async () => {
    if (!currentProfile?.id) return;

    // Get users the current user has endorsed recently
    const { data: endorsements } = await supabase
      .from('endorsements')
      .select('endorsed_id')
      .eq('endorser_id', currentProfile.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (endorsements && endorsements.length > 0) {
      const userIds = [...new Set(endorsements.map(e => e.endorsed_id))];
      
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds)
        .limit(5);

      if (users) {
        setRecentUsers(users);
      }
    }
  };

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);

      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', currentProfile?.id || '')
        .limit(10);

      if (data) {
        setResults(data);
      }
      setLoading(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query, currentProfile?.id]);

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const UserCard = ({ user }: { user: UserProfile }) => (
    <Card
      className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
      onClick={() => navigate(`/endorse/${user.id}`)}
    >
      <div className="flex items-center gap-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(user.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {user.full_name || t('common.anonymousUser')}
          </h3>
          {user.username && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
        </div>
        <Star className="w-5 h-5 text-accent" />
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            {t('endorseSelect.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('endorseSelect.subtitle')}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t('endorseSelect.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Search Results */}
        {query.length >= 2 && (
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground animate-pulse-soft">
                {t('search.searching')}
              </p>
            ) : results.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">{t('search.noUsersFound')}</p>
              </div>
            ) : (
              results.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <UserCard user={user} />
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Recent endorsements */}
        {query.length < 2 && recentUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-lg font-semibold text-foreground mb-3">
              {t('endorseSelect.recentlyEndorsed')}
            </h2>
            <div className="space-y-3">
              {recentUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <UserCard user={user} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {query.length < 2 && recentUsers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Star className="w-12 h-12 text-accent/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">
              {t('endorseSelect.emptyTitle')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('endorseSelect.emptySubtitle')}
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
