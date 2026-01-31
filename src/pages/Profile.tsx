import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LevelaScore } from '@/components/ui/LevelaScore';
import { PillarBadge } from '@/components/ui/PillarBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PILLARS, type PillarId } from '@/lib/constants';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Edit, CheckCircle, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchEndorsements();
    }
  }, [profile?.id]);

  const fetchEndorsements = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('endorsements')
      .select(`
        id,
        endorser_id,
        endorsed_id,
        pillar,
        stars,
        comment,
        created_at
      `)
      .eq('endorsed_id', profile.id)
      .eq('is_hidden', false);

    if (!error && data) {
      setEndorsements(data.map(e => ({
        ...e,
        pillar: e.pillar as PillarId,
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
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative inline-block mb-4">
            <Avatar className="w-24 h-24 border-4 border-background shadow-elevated">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            {profile?.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-background">
                <CheckCircle className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-display font-bold text-foreground">
            {profile?.full_name || 'Anonymous User'}
          </h1>
          {profile?.username && (
            <p className="text-muted-foreground">@{profile.username}</p>
          )}
          {profile?.bio && (
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              {profile.bio}
            </p>
          )}

          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate('/settings/profile')}
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </motion.div>

        {/* Levela Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <Card className="p-6 bg-card shadow-soft border-border/50">
            <LevelaScore score={score.overall} size="lg" />
            <p className="text-center text-sm text-muted-foreground mt-4">
              Based on {score.totalEndorsements} endorsement{score.totalEndorsements !== 1 ? 's' : ''}
            </p>
          </Card>
        </motion.div>

        {/* Pillars Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Your Pillars</h2>
          <div className="grid grid-cols-3 gap-3">
            {PILLARS.map((pillar, index) => {
              const pillarScore = score.pillars.find(p => p.pillar === pillar.id);
              return (
                <motion.div
                  key={pillar.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <PillarBadge
                    pillarId={pillar.id}
                    score={pillarScore?.score}
                    endorsementCount={pillarScore?.endorsementCount}
                    size="sm"
                    onClick={() => navigate(`/pillar/${pillar.id}`)}
                  />
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* How scoring works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-4 bg-muted/50 border-border/50">
            <h3 className="font-semibold text-foreground mb-2">How Your Score Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• Each endorsement rates you 1-5 stars on a pillar</li>
              <li>• Pillar score = (avg stars ÷ 5) × 100</li>
              <li>• Levela Score = average of all pillar scores</li>
              <li>• More endorsements = more credibility</li>
            </ul>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
