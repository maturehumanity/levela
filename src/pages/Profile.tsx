import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PILLARS, type PillarId, getPillarShortName, getScoreColor, getScoreLabel } from '@/lib/constants';
import { calculateLevelaScore, type Endorsement, formatScore } from '@/lib/scoring';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, GraduationCap, Heart, Shield, Users, TrendingUp, LucideIcon, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Heart,
  Shield,
  Users,
  TrendingUp,
};

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

  // Calculate positions for badges in a circular ring
  const getBadgePosition = (index: number, total: number) => {
    const angle = (index * (360 / total) - 90) * (Math.PI / 180); // Start from top
    const radius = 130; // Distance from center
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  const circumference = 2 * Math.PI * 58;
  const strokeDashoffset = circumference - (score.overall / 100) * circumference;

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
      <div className="px-4 py-6 flex flex-col items-center min-h-[calc(100vh-80px)]">
        {/* Badge Ring Container */}
        <motion.div
          className="relative w-[320px] h-[320px] flex items-center justify-center mt-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Central Avatar with Score Ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Score Ring */}
              <svg className="absolute -inset-3 w-[136px] h-[136px] -rotate-90" viewBox="0 0 136 136">
                <circle
                  cx="68"
                  cy="68"
                  r="58"
                  fill="none"
                  strokeWidth="6"
                  className="stroke-muted/30"
                />
                <motion.circle
                  cx="68"
                  cy="68"
                  r="58"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="stroke-primary"
                  style={{ strokeDasharray: circumference }}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
              </svg>
              
              {/* Avatar */}
              <Avatar className="w-28 h-28 border-4 border-background shadow-elevated">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              
              {/* Verified Badge */}
              {profile?.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-background">
                  <CheckCircle className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Floating Pillar Badges */}
          {PILLARS.map((pillar, index) => {
            const pos = getBadgePosition(index, PILLARS.length);
            const pillarScore = score.pillars.find(p => p.pillar === pillar.id);
            const Icon = iconMap[pillar.icon];
            
            return (
              <motion.button
                key={pillar.id}
                className="absolute w-16 h-16 flex flex-col items-center justify-center"
                style={{
                  left: `calc(50% + ${pos.x}px - 32px)`,
                  top: `calc(50% + ${pos.y}px - 32px)`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/pillar/${pillar.id}`)}
              >
                <div className={`w-12 h-12 rounded-full ${pillar.bgColorClass} shadow-elevated flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-foreground mt-1">
                  {pillarScore?.score !== undefined ? formatScore(pillarScore.score) : '0.0'}
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* User Info */}
        <motion.div
          className="text-center mt-4 space-y-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            {profile?.full_name || 'Anonymous User'}
          </h1>
          {profile?.username && (
            <p className="text-muted-foreground">@{profile.username}</p>
          )}
          
          {/* Score & Status */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`text-2xl font-display font-bold ${getScoreColor(score.overall)}`}>
              {formatScore(score.overall)}
            </span>
            <span className="text-sm text-muted-foreground">
              · {getScoreLabel(score.overall)}
            </span>
          </div>
        </motion.div>

        {/* Bio */}
        {profile?.bio && (
          <motion.p
            className="text-sm text-muted-foreground text-center max-w-xs mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {profile.bio}
          </motion.p>
        )}

        {/* Primary CTA */}
        <motion.div
          className="mt-8 w-full max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => navigate('/endorse/select')}
          >
            <Plus className="w-5 h-5" />
            Request First Endorsement
          </Button>
        </motion.div>

        {/* Endorsement count */}
        <motion.p
          className="text-xs text-muted-foreground mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {score.totalEndorsements === 0 
            ? 'No endorsements yet'
            : `Based on ${score.totalEndorsements} endorsement${score.totalEndorsements !== 1 ? 's' : ''}`
          }
        </motion.p>
      </div>
    </AppLayout>
  );
}