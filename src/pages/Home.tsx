import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LevelaScore } from '@/components/ui/LevelaScore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import { PILLARS, type PillarId, getPillarShortName } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Users, TrendingUp, Star } from 'lucide-react';

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

export default function Home() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [recentEndorsements, setRecentEndorsements] = useState<RecentEndorsement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;

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

    setLoading(false);
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

        {/* Recent Endorsements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
    </AppLayout>
  );
}
