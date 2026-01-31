import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LevelaScore } from '@/components/ui/LevelaScore';
import { PillarBadge } from '@/components/ui/PillarBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { PILLARS, type PillarId } from '@/lib/constants';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, CheckCircle, Star, Flag } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile: currentProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    if (!userId) return;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profileError && profileData) {
      setProfile(profileData);
    }

    const { data: endorsementData } = await supabase
      .from('endorsements')
      .select('*')
      .eq('endorsed_id', userId)
      .eq('is_hidden', false);

    if (endorsementData) {
      setEndorsements(endorsementData.map(e => ({
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

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <p className="text-muted-foreground mb-4">User not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative inline-block mb-4">
            <Avatar className="w-24 h-24 border-4 border-background shadow-elevated">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-background">
                <CheckCircle className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-display font-bold text-foreground">
            {profile.full_name || 'Anonymous User'}
          </h1>
          {profile.username && (
            <p className="text-muted-foreground">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              {profile.bio}
            </p>
          )}

          {currentProfile && currentProfile.id !== profile.id && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                className="gap-2"
                onClick={() => navigate(`/endorse/${profile.id}`)}
              >
                <Star className="w-4 h-4" />
                Endorse
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(`/report/user/${profile.id}`)}
              >
                <Flag className="w-4 h-4" />
              </Button>
            </div>
          )}
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
          <h2 className="text-lg font-semibold text-foreground mb-4">Pillars</h2>
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
                  />
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
