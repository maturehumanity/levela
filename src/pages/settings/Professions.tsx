import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, Clock3, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ProfessionRow = Database['public']['Tables']['professions']['Row'];
type ProfileProfessionRow = Database['public']['Tables']['profile_professions']['Row'];
type ProfessionStatus = Database['public']['Enums']['profession_verification_status'];

type ProfessionDraft = {
  evidence_url: string;
  notes: string;
};

const emptyDraft: ProfessionDraft = {
  evidence_url: '',
  notes: '',
};

const statusBadgeClassName: Record<ProfessionStatus, string> = {
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  suspended: 'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  revoked: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const statusIconMap = {
  pending: Clock3,
  approved: CheckCircle2,
  suspended: ShieldAlert,
  revoked: ShieldCheck,
} as const;

export default function Professions() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [savingProfessionId, setSavingProfessionId] = useState<string | null>(null);
  const [professions, setProfessions] = useState<ProfessionRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, ProfileProfessionRow>>({});
  const [drafts, setDrafts] = useState<Record<string, ProfessionDraft>>({});

  const loadData = useCallback(async () => {
    if (!profile?.id) return;

    setLoading(true);

    const [{ data: professionsData, error: professionsError }, { data: assignmentsData, error: assignmentsError }] =
      await Promise.all([
        supabase.from('professions').select('*').order('label', { ascending: true }),
        supabase.from('profile_professions').select('*').eq('profile_id', profile.id),
      ]);

    if (professionsError) {
      console.error('Error loading professions:', professionsError);
      toast.error(t('professions.loadFailed'));
      setLoading(false);
      return;
    }

    if (assignmentsError) {
      console.error('Error loading profession assignments:', assignmentsError);
      toast.error(t('professions.assignmentsLoadFailed'));
      setLoading(false);
      return;
    }

    const nextAssignments = (assignmentsData ?? []).reduce<Record<string, ProfileProfessionRow>>(
      (accumulator, assignment) => {
        accumulator[assignment.profession_id] = assignment;
        return accumulator;
      },
      {},
    );

    const nextDrafts = (professionsData ?? []).reduce<Record<string, ProfessionDraft>>((accumulator, profession) => {
      const assignment = nextAssignments[profession.id];
      accumulator[profession.id] = assignment
        ? {
            evidence_url: assignment.evidence_url || '',
            notes: assignment.notes || '',
          }
        : emptyDraft;
      return accumulator;
    }, {});

    setProfessions(professionsData ?? []);
    setAssignments(nextAssignments);
    setDrafts(nextDrafts);
    setLoading(false);
  }, [profile?.id, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const approvedAssignments = useMemo(
    () => Object.values(assignments).filter((assignment) => assignment.status === 'approved'),
    [assignments],
  );
  const pendingAssignments = useMemo(
    () => Object.values(assignments).filter((assignment) => assignment.status === 'pending'),
    [assignments],
  );

  const setDraftValue = (professionId: string, field: keyof ProfessionDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [professionId]: {
        ...(current[professionId] || emptyDraft),
        [field]: value,
      },
    }));
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;

    try {
      return new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const handleSubmitRequest = async (professionId: string) => {
    if (!profile?.id) return;

    const draft = drafts[professionId] || emptyDraft;
    setSavingProfessionId(professionId);

    const payload: Database['public']['Tables']['profile_professions']['Insert'] = {
      profile_id: profile.id,
      profession_id: professionId,
      status: 'pending',
      evidence_url: draft.evidence_url.trim() || null,
      notes: draft.notes.trim() || null,
      verified_at: null,
      verified_by: null,
    };

    const { data, error } = await supabase
      .from('profile_professions')
      .upsert(payload, { onConflict: 'profile_id,profession_id' })
      .select()
      .single();

    if (error || !data) {
      console.error('Error saving profession request:', error);
      toast.error(t('professions.saveFailed'));
      setSavingProfessionId(null);
      return;
    }

    setAssignments((current) => ({
      ...current,
      [professionId]: data as ProfileProfessionRow,
    }));
    toast.success(t('professions.requestSaved'));
    setSavingProfessionId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">{t('professions.title')}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('professions.subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('professions.approvedCount')}</p>
                <p className="text-2xl font-semibold text-foreground">{approvedAssignments.length}</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('professions.pendingCount')}</p>
                <p className="text-2xl font-semibold text-foreground">{pendingAssignments.length}</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('professions.currentRole')}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {profile ? t(`admin.roles.${profile.role}`) : '—'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t('professions.currentRoleHint')}</p>
            </div>
          </Card>
        </motion.div>

        {loading ? (
          <Card className="flex items-center justify-center gap-2 rounded-3xl border-border/60 px-6 py-20 text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('common.loading')}</span>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {professions.map((profession, index) => {
              const assignment = assignments[profession.id];
              const status = assignment?.status || null;
              const isPending = status === 'pending';
              const isReadonly = Boolean(status && status !== 'pending');
              const draft = drafts[profession.id] || emptyDraft;
              const StatusIcon = status ? statusIconMap[status] : Award;

              return (
                <motion.div
                  key={profession.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + index * 0.02 }}
                >
                  <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <h2 className="text-lg font-semibold text-foreground">{profession.label}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">{profession.description}</p>
                      </div>
                      {status ? (
                        <Badge variant="outline" className={cn('rounded-full border', statusBadgeClassName[status])}>
                          {t(`professions.statuses.${status}`)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full">
                          {t('professions.statuses.unrequested')}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('professions.evidenceUrl')}</label>
                        <Input
                          value={draft.evidence_url}
                          onChange={(event) => setDraftValue(profession.id, 'evidence_url', event.target.value)}
                          placeholder={t('professions.evidencePlaceholder')}
                          disabled={isReadonly || savingProfessionId === profession.id}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('professions.notes')}</label>
                        <Textarea
                          value={draft.notes}
                          onChange={(event) => setDraftValue(profession.id, 'notes', event.target.value)}
                          placeholder={t('professions.notesPlaceholder')}
                          disabled={isReadonly || savingProfessionId === profession.id}
                        />
                      </div>

                      {assignment?.verified_at && (
                        <p className="text-xs text-muted-foreground">
                          {t('professions.reviewedAt', { date: formatDate(assignment.verified_at) || '—' })}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          {status === 'approved'
                            ? t('professions.approvedHint')
                            : status === 'suspended'
                              ? t('professions.suspendedHint')
                              : status === 'revoked'
                                ? t('professions.revokedHint')
                                : isPending
                                  ? t('professions.pendingHint')
                                  : t('professions.unrequestedHint')}
                        </p>
                        {!isReadonly && (
                          <Button onClick={() => void handleSubmitRequest(profession.id)} disabled={savingProfessionId === profession.id}>
                            {savingProfessionId === profession.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? t('professions.updateRequest') : t('professions.requestAccess')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
