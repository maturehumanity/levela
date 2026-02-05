import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PILLARS, type PillarId, getScoreColor, getScoreLabel } from '@/lib/constants';
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

  // Create SVG arc path for ring segment
  const createArcPath = (index: number, total: number, innerRadius: number, outerRadius: number) => {
    const gapAngle = 4; // degrees gap between segments
    const segmentAngle = (360 - gapAngle * total) / total;
    const startAngle = index * (segmentAngle + gapAngle) - 90; // Start from top
    const endAngle = startAngle + segmentAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const cx = 210, cy = 210;
    
    const x1 = cx + innerRadius * Math.cos(startRad);
    const y1 = cy + innerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(startRad);
    const y2 = cy + outerRadius * Math.sin(startRad);
    const x3 = cx + outerRadius * Math.cos(endRad);
    const y3 = cy + outerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    
    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}`;
  };

  // Get badge position at center of each segment
  const getBadgePosition = (index: number, total: number) => {
    // Evenly spaced at 72° intervals, starting from top (-90°)
    const angleStep = 360 / total; // 72° for 5 pillars
    const centerAngle = index * angleStep - 90;
    const innerRadius = 115;
    const outerRadius = 200;
    const radius = (innerRadius + outerRadius) / 2; // Exact midline of the ring
    const rad = (centerAngle * Math.PI) / 180;
    
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
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
        {/* Segmented Identity Dial */}
        <motion.div
          className="relative w-[420px] h-[420px] flex items-center justify-center mt-2"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Ring Segments - The pillars ARE the ring */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 420 420">
            {PILLARS.map((pillar, index) => (
              <motion.path
                key={pillar.id}
                d={createArcPath(index, PILLARS.length, 115, 200)}
                className="fill-muted/40 stroke-border cursor-pointer hover:fill-muted/60 transition-colors"
                strokeWidth="1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                onClick={() => navigate(`/pillar/${pillar.id}`)}
              />
            ))}
          </svg>

          {/* Pill Badges Embedded in Ring Segments */}
          {PILLARS.map((pillar, index) => {
            const pos = getBadgePosition(index, PILLARS.length);
            const pillarScore = score.pillars.find(p => p.pillar === pillar.id);
            const Icon = iconMap[pillar.icon];
            
            return (
              <motion.button
                key={pillar.id}
                className="absolute flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-background/50 transition-all z-10"
                style={{
                  left: `calc(50% + ${pos.x}px)`,
                  top: `calc(50% + ${pos.y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.08, duration: 0.3 }}
                onClick={() => navigate(`/pillar/${pillar.id}`)}
              >
                <div className={`w-5 h-5 rounded-md ${pillar.bgColorClass} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3 h-3 text-primary-foreground" />
                </div>
                <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">
                  {pillar.shortName}
                </span>
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                  {pillarScore?.score !== undefined ? formatScore(pillarScore.score) : '0.0'}
                </span>
              </motion.button>
            );
          })}

          {/* Central Avatar with Score Ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative pointer-events-auto">
              {/* Score Progress Ring */}
              <svg className="absolute -inset-3 w-[136px] h-[136px] -rotate-90" viewBox="0 0 136 136">
                <circle
                  cx="68"
                  cy="68"
                  r="58"
                  fill="none"
                  strokeWidth="5"
                  className="stroke-background"
                />
                <circle
                  cx="68"
                  cy="68"
                  r="58"
                  fill="none"
                  strokeWidth="4"
                  className="stroke-muted/40"
                />
                <motion.circle
                  cx="68"
                  cy="68"
                  r="58"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="stroke-primary"
                  style={{ strokeDasharray: 2 * Math.PI * 58 }}
                  initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 58 - (score.overall / 100) * 2 * Math.PI * 58 }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
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
