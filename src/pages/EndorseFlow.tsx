import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarRating } from '@/components/ui/StarRating';
import { PillarBadge } from '@/components/ui/PillarBadge';
import { supabase } from '@/integrations/supabase/client';
import { PILLARS, type PillarId } from '@/lib/constants';
import { canEndorse, type Endorsement } from '@/lib/scoring';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Send, AlertCircle, Clock } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export default function EndorseFlow() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile: currentProfile } = useAuth();
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [existingEndorsements, setExistingEndorsements] = useState<Endorsement[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<PillarId | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    if (!userId || !currentProfile?.id) return;

    // Fetch target user
    const { data: userData } = await supabase
      .from('profiles')
      .select('id, user_id, username, full_name, avatar_url')
      .eq('id', userId)
      .single();

    if (userData) {
      setTargetUser(userData);
    }

    // Fetch existing endorsements from current user to target
    const { data: endorsementData } = await supabase
      .from('endorsements')
      .select('*')
      .eq('endorser_id', currentProfile.id)
      .eq('endorsed_id', userId);

    if (endorsementData) {
      setExistingEndorsements(endorsementData.map(e => ({
        ...e,
        pillar: e.pillar as PillarId,
      })));
    }

    setLoading(false);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handlePillarSelect = (pillarId: PillarId) => {
    if (!currentProfile?.id || !userId) return;

    const check = canEndorse(existingEndorsements, currentProfile.id, userId, pillarId);
    
    if (!check.canEndorse) {
      toast.error(check.reason);
      return;
    }

    setSelectedPillar(pillarId);
    setStars(0);
    setComment('');
  };

  const handleSubmit = async () => {
    if (!currentProfile?.id || !userId || !selectedPillar || stars === 0) {
      toast.error('Please select a star rating');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from('endorsements')
      .insert({
        endorser_id: currentProfile.id,
        endorsed_id: userId,
        pillar: selectedPillar,
        stars,
        comment: comment.trim() || null,
      });

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    toast.success('Endorsement submitted!');
    navigate(`/user/${userId}`);
  };

  const getPillarStatus = (pillarId: PillarId) => {
    if (!currentProfile?.id || !userId) return { status: 'available' as const };

    const check = canEndorse(existingEndorsements, currentProfile.id, userId, pillarId);
    
    if (!check.canEndorse) {
      return {
        status: 'cooldown' as const,
        nextAvailable: check.nextAvailable,
        reason: check.reason,
      };
    }

    return { status: 'available' as const };
  };

  if (loading) {
    return (
      <AppLayout hideNav>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse-soft text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (!targetUser) {
    return (
      <AppLayout hideNav>
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <p className="text-muted-foreground mb-4">User not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <div className="px-4 py-6 space-y-6 min-h-screen">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectedPillar ? setSelectedPillar(null) : navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {selectedPillar ? 'Back to Pillars' : 'Back'}
        </Button>

        {/* Target user info */}
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Avatar className="w-16 h-16 border-2 border-border">
            <AvatarImage src={targetUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-display">
              {getInitials(targetUser.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">
              Endorse {targetUser.full_name || 'User'}
            </h1>
            {targetUser.username && (
              <p className="text-muted-foreground">@{targetUser.username}</p>
            )}
          </div>
        </motion.div>

        {!selectedPillar ? (
          // Pillar selection
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-foreground">
              Select a pillar to endorse
            </h2>
            <div className="space-y-3">
              {PILLARS.map((pillar, index) => {
                const status = getPillarStatus(pillar.id);
                const isAvailable = status.status === 'available';

                return (
                  <motion.div
                    key={pillar.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`p-4 ${
                        isAvailable
                          ? 'cursor-pointer hover:shadow-elevated'
                          : 'opacity-60'
                      } transition-all`}
                      onClick={() => isAvailable && handlePillarSelect(pillar.id)}
                    >
                      <div className="flex items-center gap-4">
                        <PillarBadge
                          pillarId={pillar.id}
                          size="sm"
                          showDetails={false}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {pillar.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {pillar.description}
                          </p>
                          {!isAvailable && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{status.reason}</span>
                            </div>
                          )}
                        </div>
                        {isAvailable ? (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          // Endorsement form
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Card className="p-4">
              <PillarBadge
                pillarId={selectedPillar}
                size="md"
                showDetails={false}
              />
              <h2 className="font-semibold text-foreground mt-3">
                {PILLARS.find(p => p.id === selectedPillar)?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {PILLARS.find(p => p.id === selectedPillar)?.description}
              </p>
            </Card>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  How would you rate {targetUser.full_name?.split(' ')[0] || 'them'}?
                </Label>
                <div className="flex justify-center py-4">
                  <StarRating
                    value={stars}
                    onChange={setStars}
                    size="lg"
                    showValue
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="comment" className="text-base font-semibold mb-3 block">
                  Add a comment (optional)
                </Label>
                <Textarea
                  id="comment"
                  placeholder="Share why you're endorsing this person..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {comment.length}/500
                </p>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={stars === 0 || submitting}
              className="w-full gap-2"
              size="lg"
            >
              {submitting ? 'Submitting...' : 'Submit Endorsement'}
              <Send className="w-4 h-4" />
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You can endorse this pillar again in 30 days
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
