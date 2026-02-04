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
  // Badges positioned at: top, top-right, bottom-right, bottom-left, top-left
  const getBadgePosition = (index: number) => {
    // Custom angles for better horizontal pill badge placement
    // Positions: top (0), right-top (1), right-bottom (2), left-bottom (3), left-top (4)
    const angles = [-90, -18, 54, 126, 198]; // degrees, starting from top
    const angle = angles[index] * (Math.PI / 180);
    const radius = 180; // Distance from center to badge center
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
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
      <div className="px-4 py-6 flex flex-col items-center min-h-[calc(100vh-80px)]">
        {/* Badge Ring Container */}
        <motion.div
          className="relative w-[420px] h-[420px] flex items-center justify-center mt-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Dotted Guide Ring */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 420 420">
            <circle
              cx="210"
              cy="210"
              r="150"
              fill="none"
              strokeWidth="2"
              strokeDasharray="6 8"
              className="stroke-muted-foreground/20"
            />
          </svg>

          {/* Central Avatar with Score Ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Score Ring */}
              <svg className="absolute -inset-4 w-[144px] h-[144px] -rotate-90" viewBox="0 0 144 144">
                <circle
                  cx="72"
                  cy="72"
                  r="62"
                  fill="none"
                  strokeWidth="6"
                  className="stroke-muted/30"
                />
                <motion.circle
                  cx="72"
                  cy="72"
                  r="62"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="stroke-primary"
                  style={{ strokeDasharray: 2 * Math.PI * 62 }}
                  initial={{ strokeDashoffset: 2 * Math.PI * 62 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 62 - (score.overall / 100) * 2 * Math.PI * 62 }}
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

          {/* Horizontal Pill Badges */}
          {PILLARS.map((pillar, index) => {
            const pos = getBadgePosition(index);
            const pillarScore = score.pillars.find(p => p.pillar === pillar.id);
            const Icon = iconMap[pillar.icon];
            
            return (
              <motion.button
                key={pillar.id}
                className="absolute flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border/50 shadow-soft hover:shadow-elevated transition-shadow"
                style={{
                  left: `calc(50% + ${pos.x}px)`,
                  top: `calc(50% + ${pos.y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/pillar/${pillar.id}`)}
              >
                <div className={`w-7 h-7 rounded-full ${pillar.bgColorClass} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground whitespace-nowrap">
                  {pillar.shortName}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
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