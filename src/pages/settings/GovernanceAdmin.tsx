import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Landmark, Loader2, Save, Settings2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import {
  calculateQuarterlyIssuanceCeiling,
  createMonetaryPolicy,
  evaluatePolicySignals,
  type MonetaryPolicy,
} from '@/lib/monetary';

const GOVERNANCE_POLICY_STORAGE_KEY = 'levela-governance-policy-v1';

type GovernancePolicyState = Pick<
  MonetaryPolicy,
  | 'activeCitizens'
  | 'civicLiquidityBaseline'
  | 'approvedPublicBudget'
  | 'outputLiquidityRatio'
  | 'inflationTarget'
  | 'stabilityDampeningMultiplier'
  | 'autoApprovalLimit'
  | 'maxInflationRisk'
  | 'affordabilityAlertThreshold'
>;

type PolicyProfileRow = Database['public']['Tables']['monetary_policy_profiles']['Row'];
type PolicyApprovalRow = Database['public']['Tables']['monetary_policy_approvals']['Row'];
type PolicyAuditEventRow = Database['public']['Tables']['monetary_policy_audit_events']['Row'];

type ApprovalClass = 'ordinary' | 'elevated' | 'emergency';
type ApprovalDecision = 'approved' | 'rejected';

function isMissingGovernanceBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('monetary_policy_')
  );
}

function readPolicyState(defaults: GovernancePolicyState): GovernancePolicyState {
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(GOVERNANCE_POLICY_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GovernancePolicyState>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function persistPolicyState(values: GovernancePolicyState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(GOVERNANCE_POLICY_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore quota / serialization issues and keep in-memory edits.
  }
}

function parseNumeric(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function GovernanceAdmin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useAuth();

  const defaults = useMemo(
    () =>
      createMonetaryPolicy({
        activeCitizens: 10_000,
        civicLiquidityBaseline: 25,
        approvedPublicBudget: 200_000,
      }),
    [],
  );

  const [form, setForm] = useState<GovernancePolicyState>(() =>
    readPolicyState({
      activeCitizens: defaults.activeCitizens,
      civicLiquidityBaseline: defaults.civicLiquidityBaseline,
      approvedPublicBudget: defaults.approvedPublicBudget,
      outputLiquidityRatio: defaults.outputLiquidityRatio,
      inflationTarget: defaults.inflationTarget,
      stabilityDampeningMultiplier: defaults.stabilityDampeningMultiplier,
      autoApprovalLimit: defaults.autoApprovalLimit,
      maxInflationRisk: defaults.maxInflationRisk,
      affordabilityAlertThreshold: defaults.affordabilityAlertThreshold,
    }),
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadingRemoteState, setLoadingRemoteState] = useState(true);
  const [governanceBackendUnavailable, setGovernanceBackendUnavailable] = useState(false);
  const [activePolicyId, setActivePolicyId] = useState<string | null>(null);
  const [approvalRows, setApprovalRows] = useState<PolicyApprovalRow[]>([]);
  const [auditRows, setAuditRows] = useState<PolicyAuditEventRow[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [recordingApproval, setRecordingApproval] = useState(false);
  const [approvalClass, setApprovalClass] = useState<ApprovalClass>('ordinary');
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>('approved');
  const [approvalNotes, setApprovalNotes] = useState('');
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    let cancelled = false;

    const loadGovernanceState = async () => {
      if (!profile?.id) {
        setLoadingRemoteState(false);
        return;
      }

      const policyResponse = await supabase
        .from('monetary_policy_profiles')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (isMissingGovernanceBackend(policyResponse.error)) {
        setGovernanceBackendUnavailable(true);
        setLoadingRemoteState(false);
        return;
      }

      if (policyResponse.error) {
        console.error('Failed to load governance policy:', policyResponse.error);
        toast.error(t('governance.errors.loadFailed'));
        setLoadingRemoteState(false);
        return;
      }

      const activePolicy = policyResponse.data as PolicyProfileRow | null;

      if (activePolicy) {
        const remotePolicy = activePolicy.policy_json as Partial<GovernancePolicyState>;
        const merged = {
          ...form,
          ...remotePolicy,
        };
        setForm(merged);
        persistPolicyState(merged);
        setActivePolicyId(activePolicy.id);

        const [approvalsResponse, auditResponse] = await Promise.all([
          supabase
            .from('monetary_policy_approvals')
            .select('*')
            .eq('policy_profile_id', activePolicy.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('monetary_policy_audit_events')
            .select('*')
            .eq('policy_profile_id', activePolicy.id)
            .order('created_at', { ascending: false })
            .limit(12),
        ]);

        if (cancelled) return;

        if (approvalsResponse.error || auditResponse.error) {
          console.error('Failed to load governance approvals/audit:', {
            approvalsError: approvalsResponse.error,
            auditError: auditResponse.error,
          });
        } else {
          setApprovalRows((approvalsResponse.data as PolicyApprovalRow[]) || []);
          setAuditRows((auditResponse.data as PolicyAuditEventRow[]) || []);
        }
      }

      setLoadingRemoteState(false);
    };

    void loadGovernanceState();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, t]);

  const policy = createMonetaryPolicy(form);

  const projectedQuarterlyCeiling = calculateQuarterlyIssuanceCeiling(policy, {
    inflationRate: 0.031,
    verifiedOutputValue: 350_000,
  });

  const policySignals = evaluatePolicySignals(
    {
      inflationRate: 0.031,
      verifiedOutputValue: 350_000,
      reserveCoverageRatio: 0.24,
      idleLiquidityRatio: 0.27,
      affordabilityPressure: 0.06,
      civicBasketIndex: 106,
    },
    policy,
  );

  const updateField = (field: keyof GovernancePolicyState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: parseNumeric(value, current[field]),
    }));
  };

  const persistAuditEvent = async (payload: {
    policyProfileId: string;
    eventType: string;
    body: Record<string, Json>;
  }) => {
    if (!profile?.id || governanceBackendUnavailable) return;

    const { error } = await supabase
      .from('monetary_policy_audit_events')
      .insert({
        policy_profile_id: payload.policyProfileId,
        actor_id: profile.id,
        event_type: payload.eventType,
        payload: payload.body,
      });

    if (error) {
      console.error('Failed to persist governance audit event:', error);
    }
  };

  const handleSave = async () => {
    persistPolicyState(form);
    setSavedAt(new Date().toISOString());

    if (!profile?.id || governanceBackendUnavailable) return;

    setSavingPolicy(true);

    const deactivateResponse = await supabase
      .from('monetary_policy_profiles')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateResponse.error) {
      console.error('Failed to deactivate old policy profiles:', deactivateResponse.error);
      toast.error(t('governance.errors.saveFailed'));
      setSavingPolicy(false);
      return;
    }

    const saveResponse = await supabase
      .from('monetary_policy_profiles')
      .insert({
        policy_name: 'Foundational Monetary Policy',
        version: '1.0.0-foundational',
        policy_json: form,
        is_active: true,
        created_by: profile.id,
      })
      .select('*')
      .single();

    if (saveResponse.error) {
      console.error('Failed to save policy profile:', saveResponse.error);
      toast.error(t('governance.errors.saveFailed'));
      setSavingPolicy(false);
      return;
    }

    const savedPolicy = saveResponse.data as PolicyProfileRow;
    setActivePolicyId(savedPolicy.id);
    setApprovalRows([]);

    await persistAuditEvent({
      policyProfileId: savedPolicy.id,
      eventType: 'policy_saved',
      body: {
        projected_quarterly_ceiling: projectedQuarterlyCeiling,
        inflation_target: form.inflationTarget,
      },
    });

    const auditResponse = await supabase
      .from('monetary_policy_audit_events')
      .select('*')
      .eq('policy_profile_id', savedPolicy.id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (!auditResponse.error) {
      setAuditRows((auditResponse.data as PolicyAuditEventRow[]) || []);
    }

    toast.success(t('governance.saved'));
    setSavingPolicy(false);
  };

  const handleRecordApproval = async () => {
    if (!profile?.id || !activePolicyId || governanceBackendUnavailable) return;

    setRecordingApproval(true);

    const approvalResponse = await supabase
      .from('monetary_policy_approvals')
      .upsert(
        {
          policy_profile_id: activePolicyId,
          approver_id: profile.id,
          approval_class: approvalClass,
          decision: approvalDecision,
          notes: approvalNotes || null,
        },
        { onConflict: 'policy_profile_id,approver_id,approval_class' },
      );

    if (approvalResponse.error) {
      console.error('Failed to record policy approval:', approvalResponse.error);
      toast.error(t('governance.errors.approvalFailed'));
      setRecordingApproval(false);
      return;
    }

    await persistAuditEvent({
      policyProfileId: activePolicyId,
      eventType: 'approval_recorded',
      body: {
        approval_class: approvalClass,
        decision: approvalDecision,
      },
    });

    const [approvalsReload, auditReload] = await Promise.all([
      supabase
        .from('monetary_policy_approvals')
        .select('*')
        .eq('policy_profile_id', activePolicyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('monetary_policy_audit_events')
        .select('*')
        .eq('policy_profile_id', activePolicyId)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    if (!approvalsReload.error) {
      setApprovalRows((approvalsReload.data as PolicyApprovalRow[]) || []);
    }
    if (!auditReload.error) {
      setAuditRows((auditReload.data as PolicyAuditEventRow[]) || []);
    }

    setApprovalNotes('');
    setRecordingApproval(false);
    toast.success(t('governance.approvalRecorded'));
  };

  const approvalSummary = useMemo(() => {
    const summary = {
      ordinary: 0,
      elevated: 0,
      emergency: 0,
    };

    for (const row of approvalRows) {
      if (row.decision === 'approved' && (row.approval_class in summary)) {
        const key = row.approval_class as ApprovalClass;
        summary[key] += 1;
      }
    }

    return summary;
  }, [approvalRows]);

  const formatTimestamp = (value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 px-4 py-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{t('governance.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('governance.subtitle')}</p>
              {governanceBackendUnavailable && (
                <p className="mt-1 text-xs text-muted-foreground">{t('governance.localMode')}</p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{t('governance.policyControlsTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('governance.policyControlsDescription')}</p>
              </div>
              <div className="flex items-center gap-2">
                {savedAt && <Badge variant="secondary">{t('governance.saved')}</Badge>}
                <Button onClick={() => void handleSave()} className="gap-2" disabled={savingPolicy || loadingRemoteState}>
                  {savingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('governance.savePolicy')}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activeCitizens">{t('governance.fields.activeCitizens')}</Label>
                <Input
                  id="activeCitizens"
                  type="number"
                  value={form.activeCitizens}
                  onChange={(event) => updateField('activeCitizens', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="civicLiquidityBaseline">{t('governance.fields.civicLiquidityBaseline')}</Label>
                <Input
                  id="civicLiquidityBaseline"
                  type="number"
                  step="0.01"
                  value={form.civicLiquidityBaseline}
                  onChange={(event) => updateField('civicLiquidityBaseline', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputLiquidityRatio">{t('governance.fields.outputLiquidityRatio')}</Label>
                <Input
                  id="outputLiquidityRatio"
                  type="number"
                  step="0.001"
                  value={form.outputLiquidityRatio}
                  onChange={(event) => updateField('outputLiquidityRatio', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedPublicBudget">{t('governance.fields.approvedPublicBudget')}</Label>
                <Input
                  id="approvedPublicBudget"
                  type="number"
                  step="0.01"
                  value={form.approvedPublicBudget}
                  onChange={(event) => updateField('approvedPublicBudget', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inflationTarget">{t('governance.fields.inflationTarget')}</Label>
                <Input
                  id="inflationTarget"
                  type="number"
                  step="0.001"
                  value={form.inflationTarget}
                  onChange={(event) => updateField('inflationTarget', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stabilityDampeningMultiplier">{t('governance.fields.stabilityDampeningMultiplier')}</Label>
                <Input
                  id="stabilityDampeningMultiplier"
                  type="number"
                  step="1"
                  value={form.stabilityDampeningMultiplier}
                  onChange={(event) => updateField('stabilityDampeningMultiplier', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autoApprovalLimit">{t('governance.fields.autoApprovalLimit')}</Label>
                <Input
                  id="autoApprovalLimit"
                  type="number"
                  step="0.01"
                  value={form.autoApprovalLimit}
                  onChange={(event) => updateField('autoApprovalLimit', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxInflationRisk">{t('governance.fields.maxInflationRisk')}</Label>
                <Input
                  id="maxInflationRisk"
                  type="number"
                  step="0.001"
                  value={form.maxInflationRisk}
                  onChange={(event) => updateField('maxInflationRisk', event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="affordabilityAlertThreshold">{t('governance.fields.affordabilityAlertThreshold')}</Label>
                <Input
                  id="affordabilityAlertThreshold"
                  type="number"
                  step="0.001"
                  value={form.affordabilityAlertThreshold}
                  onChange={(event) => updateField('affordabilityAlertThreshold', event.target.value)}
                />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-3 lg:grid-cols-2"
        >
          <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">{t('governance.simulationTitle')}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('governance.simulationDescription')}</p>
            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {t('governance.simulationQuarterlyCeiling')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {projectedQuarterlyCeiling.toLocaleString()}
              </p>
            </div>
          </Card>

          <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">{t('governance.guardrailStatusTitle')}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('governance.guardrailStatusDescription')}</p>
            <div className="mt-3">
              <Badge
                variant={policySignals.status === 'stable' ? 'secondary' : 'outline'}
                className="rounded-full"
              >
                {t(`governance.status.${policySignals.status}`)}
              </Badge>
              <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                {policySignals.alerts.length === 0 ? (
                  <li>{t('governance.noAlerts')}</li>
                ) : (
                  policySignals.alerts.map((alert) => (
                    <li key={alert.code}>{alert.message}</li>
                  ))
                )}
              </ul>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="grid gap-3 lg:grid-cols-2"
        >
          <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
            <h3 className="font-semibold text-foreground">{t('governance.approvalsTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('governance.approvalsDescription')}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Badge variant="outline" className="justify-center py-1">
                {t('governance.approvalClass.ordinary')}: {approvalSummary.ordinary}
              </Badge>
              <Badge variant="outline" className="justify-center py-1">
                {t('governance.approvalClass.elevated')}: {approvalSummary.elevated}
              </Badge>
              <Badge variant="outline" className="justify-center py-1">
                {t('governance.approvalClass.emergency')}: {approvalSummary.emergency}
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('governance.approvalClassLabel')}</Label>
                  <Select value={approvalClass} onValueChange={(value) => setApprovalClass(value as ApprovalClass)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordinary">{t('governance.approvalClass.ordinary')}</SelectItem>
                      <SelectItem value="elevated">{t('governance.approvalClass.elevated')}</SelectItem>
                      <SelectItem value="emergency">{t('governance.approvalClass.emergency')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('governance.approvalDecisionLabel')}</Label>
                  <Select value={approvalDecision} onValueChange={(value) => setApprovalDecision(value as ApprovalDecision)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">{t('governance.approvalDecision.approved')}</SelectItem>
                      <SelectItem value="rejected">{t('governance.approvalDecision.rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('governance.approvalNotesLabel')}</Label>
                <Textarea
                  value={approvalNotes}
                  onChange={(event) => setApprovalNotes(event.target.value)}
                  placeholder={t('governance.approvalNotesPlaceholder')}
                />
              </div>

              <Button
                onClick={() => void handleRecordApproval()}
                disabled={!activePolicyId || recordingApproval || loadingRemoteState}
                className="gap-2"
              >
                {recordingApproval && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('governance.recordApproval')}
              </Button>
            </div>
          </Card>

          <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
            <h3 className="font-semibold text-foreground">{t('governance.auditLogTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('governance.auditLogDescription')}</p>

            {auditRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t('governance.noAuditEvents')}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {auditRows.map((row) => (
                  <li key={row.id} className="rounded-xl border border-border/60 bg-background/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{row.event_type}</span>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(row.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
