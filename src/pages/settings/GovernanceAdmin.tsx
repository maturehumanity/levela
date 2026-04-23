import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Landmark } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import {
  clearStoredCitizenSigningKey,
  formatCitizenSigningFingerprint,
  generateCitizenSigningKey,
  readStoredCitizenSigningKey,
  signGovernanceIntent,
  storeCitizenSigningKey,
} from '@/lib/governance-signing';
import {
  MIN_GOVERNANCE_SCORE,
  evaluateGovernanceEligibility,
  isNativeGovernanceApp,
  normalizeGovernanceScoreForRole,
  type GovernanceEligibilityReason,
} from '@/lib/governance-eligibility';
import {
  persistGovernanceEligibilitySnapshot,
  sameGovernanceEligibilitySnapshot,
  type GovernanceEligibilitySnapshotPayload,
} from '@/lib/governance-eligibility-snapshots';
import { coerceCitizenshipStatus, deriveProjectedCitizenshipStatus } from '@/lib/civic-status';
import {
  calculateQuarterlyIssuanceCeiling,
  createMonetaryPolicy,
  evaluatePolicySignals,
  type MonetaryPolicy,
} from '@/lib/monetary';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import type { PillarId } from '@/lib/constants';
import { GovernanceEligibilityCard } from '@/components/governance/GovernanceEligibilityCard';
import { GovernanceKeyManagerCard } from '@/components/governance/GovernanceKeyManagerCard';
import { GovernancePolicyFormCard } from '@/components/governance/GovernancePolicyFormCard';
import { GovernanceInsightsGrid } from '@/components/governance/GovernanceInsightsGrid';
import { GovernanceApprovalCard } from '@/components/governance/GovernanceApprovalCard';
import { GovernanceAuditCard } from '@/components/governance/GovernanceAuditCard';
import { GovernanceMaturityReviewCard } from '@/components/governance/GovernanceMaturityReviewCard';
import { GovernanceActivationReviewCard } from '@/components/governance/GovernanceActivationReviewCard';
import { GovernanceGuardianMultisigCard } from '@/components/governance/GovernanceGuardianMultisigCard';
import { GovernancePublicAuditAnchoringCard } from '@/components/governance/GovernancePublicAuditAnchoringCard';
import type {
  GovernanceDomainMaturitySnapshotRow,
  GovernanceDomainMaturityTransitionRow,
  GovernanceDomainRow,
} from '@/lib/governance-maturity';
import { useGovernanceActivationReview } from '@/lib/use-governance-activation-review';
import { useGovernanceGuardianMultisig } from '@/lib/use-governance-guardian-multisig';
import { useGovernancePublicAuditAnchoring } from '@/lib/use-governance-public-audit-anchoring';
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
type GovernanceIntentRow = Database['public']['Tables']['governance_action_intents']['Row'];

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

function isMissingMaturityBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || message.includes('governance_domain_maturity_')
    || message.includes('capture_scheduled_governance_domain_maturity_snapshots')
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
  const location = useLocation();
  const { t } = useLanguage();
  const { profile, refreshProfile } = useAuth();

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
  const [governanceScore, setGovernanceScore] = useState<number | null>(null);
  const [governanceEndorsementCount, setGovernanceEndorsementCount] = useState(0);
  const [loadingGovernanceEligibility, setLoadingGovernanceEligibility] = useState(true);
  const [governanceEligibilityUnavailable, setGovernanceEligibilityUnavailable] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [recordingApproval, setRecordingApproval] = useState(false);
  const [generatingCitizenKey, setGeneratingCitizenKey] = useState(false);
  const [hasLocalCitizenKey, setHasLocalCitizenKey] = useState(false);
  const [citizenKeyMismatch, setCitizenKeyMismatch] = useState(false);
  const [governanceIntentBackendUnavailable, setGovernanceIntentBackendUnavailable] = useState(false);
  const [approvalClass, setApprovalClass] = useState<ApprovalClass>('ordinary');
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>('approved');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [loadingMaturityReview, setLoadingMaturityReview] = useState(true);
  const [maturityBackendUnavailable, setMaturityBackendUnavailable] = useState(false);
  const [refreshingAllMaturitySnapshots, setRefreshingAllMaturitySnapshots] = useState(false);
  const [refreshingDomainMaturityKey, setRefreshingDomainMaturityKey] = useState<string | null>(null);
  const [maturityDomains, setMaturityDomains] = useState<GovernanceDomainRow[]>([]);
  const [latestMaturitySnapshotsByDomain, setLatestMaturitySnapshotsByDomain] = useState<
    Record<string, GovernanceDomainMaturitySnapshotRow | undefined>
  >({});
  const [latestMaturityTransitionsByDomain, setLatestMaturityTransitionsByDomain] = useState<
    Record<string, GovernanceDomainMaturityTransitionRow | undefined>
  >({});
  const [recentMaturityTransitions, setRecentMaturityTransitions] = useState<GovernanceDomainMaturityTransitionRow[]>([]);
  const lastEligibilitySnapshotRef = useRef<GovernanceEligibilitySnapshotPayload | null>(null);
  const isNativeMobileGovernanceDevice = useMemo(() => isNativeGovernanceApp(), []);
  const citizenKeyFingerprint = useMemo(
    () => formatCitizenSigningFingerprint(profile?.citizen_signing_public_key ?? null),
    [profile?.citizen_signing_public_key],
  );
  const governanceEligibility = useMemo(
    () =>
      evaluateGovernanceEligibility({
        isVerified: Boolean(profile?.is_verified),
        role: profile?.role,
        score: governanceScore,
        isNativeMobileApp: isNativeMobileGovernanceDevice,
        minScore: MIN_GOVERNANCE_SCORE,
      }),
    [governanceScore, isNativeMobileGovernanceDevice, profile?.is_verified, profile?.role],
  );
  const governanceRequirementMessages = useMemo(() => {
    const messageByReason: Record<GovernanceEligibilityReason, string> = {
      mobile_app_required: t('governance.requirementMobile'),
      verified_required: t('governance.requirementVerified'),
      minimum_score_required: t('governance.requirementScore'),
      score_unavailable: t('governance.requirementScoreUnavailable'),
    };

    return governanceEligibility.reasons.map((reason) => messageByReason[reason]);
  }, [governanceEligibility.reasons, t]);
  const projectedCitizenshipStatus = useMemo(
    () => deriveProjectedCitizenshipStatus(profile?.role, Boolean(profile?.is_verified)),
    [profile?.is_verified, profile?.role],
  );
  const effectiveCitizenshipStatus = useMemo(
    () => coerceCitizenshipStatus(profile?.citizenship_status, projectedCitizenshipStatus),
    [profile?.citizenship_status, projectedCitizenshipStatus],
  );
  const governanceEligibilitySnapshot = useMemo<GovernanceEligibilitySnapshotPayload | null>(() => {
    if (!profile?.id || governanceScore === null) return null;

    return {
      profileId: profile.id,
      citizenshipStatus: effectiveCitizenshipStatus,
      isVerified: Boolean(profile.is_verified),
      isActiveCitizen: Boolean(profile.is_active_citizen),
      levelaScore: governanceScore,
      governanceScore,
      eligible: governanceEligibility.eligible,
      influenceWeight: governanceEligibility.influenceWeight,
      reasons: governanceEligibility.reasons,
    };
  }, [
    effectiveCitizenshipStatus,
    governanceEligibility.eligible,
    governanceEligibility.influenceWeight,
    governanceEligibility.reasons,
    governanceScore,
    profile?.id,
    profile?.is_active_citizen,
    profile?.is_verified,
  ]);
  const {
    loadingActivationReview,
    activationReviewBackendUnavailable,
    refreshingAllActivationDemographics,
    refreshingActivationScopeKey,
    savingActivationDemographicSnapshot,
    recordingActivationDecisionReviewId,
    activationReviews,
    activationDemographicSnapshots,
    latestActivationEvidenceByReviewId,
    latestActivationDecisionByReviewId,
    handleRefreshAllActivationDemographics,
    handleRefreshActivationScopeDemographics,
    handleSaveActivationDemographicSnapshot,
    handleRecordActivationDecision,
  } = useGovernanceActivationReview({ profileId: profile?.id });
  const {
    loadingGuardianMultisig,
    guardianMultisigBackendUnavailable,
    savingGuardianPolicy,
    addingGuardianSigner,
    togglingSignerId,
    guardianPolicy,
    guardianSigners,
    activeSignerCount,
    saveGuardianPolicy,
    addGuardianSigner,
    setGuardianSignerActive,
    refreshGuardianMultisig,
  } = useGovernanceGuardianMultisig({ profileId: profile?.id });
  const {
    loadingPublicAudit,
    publicAuditBackendUnavailable,
    creatingPublicAuditBatch,
    recordingPublicAuditAnchor,
    publicAuditBatches,
    publicAuditChainStatus,
    publicAuditAnchorNetwork,
    publicAuditAnchorReference,
    setPublicAuditAnchorNetwork,
    setPublicAuditAnchorReference,
    handleCapturePublicAuditBatch,
    handleRecordLatestPublicAuditAnchor,
  } = useGovernancePublicAuditAnchoring({ profileId: profile?.id });

  const refreshCitizenKeyStatus = useCallback(() => {
    if (!profile?.id) {
      setHasLocalCitizenKey(false);
      setCitizenKeyMismatch(false);
      return;
    }

    const localKey = readStoredCitizenSigningKey(profile.id);
    const registeredPublicKey = profile.citizen_signing_public_key ?? null;
    const localPublicKey = localKey?.publicKey ?? null;

    setHasLocalCitizenKey(Boolean(localKey));
    setCitizenKeyMismatch(Boolean(registeredPublicKey && localPublicKey && registeredPublicKey !== localPublicKey));
  }, [profile?.citizen_signing_public_key, profile?.id]);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    refreshCitizenKeyStatus();
  }, [refreshCitizenKeyStatus]);

  useEffect(() => {
    const hash = location.hash;
    if (hash !== '#stewardship-public-audit-tools' && hash !== '#stewardship-activation-review') {
      return;
    }

    const targetId = hash === '#stewardship-activation-review'
      ? 'stewardship-activation-review'
      : 'stewardship-public-audit-tools';

    const scrollToTarget = () => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    scrollToTarget();
    const retryId = window.setTimeout(scrollToTarget, 320);
    return () => window.clearTimeout(retryId);
  }, [
    location.hash,
    location.pathname,
    loadingActivationReview,
    loadingPublicAudit,
    loadingRemoteState,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadGovernanceEligibility = async () => {
      if (!profile?.id) {
        setGovernanceScore(null);
        setGovernanceEndorsementCount(0);
        setGovernanceEligibilityUnavailable(false);
        setLoadingGovernanceEligibility(false);
        return;
      }

      setLoadingGovernanceEligibility(true);

      const { data, error } = await supabase
        .from('endorsements')
        .select('id, endorser_id, endorsed_id, pillar, stars, comment, created_at')
        .eq('endorsed_id', profile.id)
        .eq('is_hidden', false);

      if (cancelled) return;

      if (error) {
        console.error('Failed to load governance eligibility score:', error);
        setGovernanceScore(null);
        setGovernanceEndorsementCount(0);
        setGovernanceEligibilityUnavailable(true);
        setLoadingGovernanceEligibility(false);
        return;
      }

      const typedEndorsements = ((data || []) as Endorsement[]).map((item) => ({
        ...item,
        pillar: item.pillar as PillarId,
      }));
      const computedScore = calculateLevelaScore(typedEndorsements);
      const normalizedScore = normalizeGovernanceScoreForRole(profile.role, computedScore.overall);

      setGovernanceScore(normalizedScore);
      setGovernanceEndorsementCount(computedScore.totalEndorsements);
      setGovernanceEligibilityUnavailable(false);
      setLoadingGovernanceEligibility(false);
    };

    void loadGovernanceEligibility();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

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

  useEffect(() => {
    if (!profile?.id || loadingGovernanceEligibility || governanceEligibilityUnavailable || !governanceEligibilitySnapshot) {
      return;
    }

    if (
      lastEligibilitySnapshotRef.current
      && sameGovernanceEligibilitySnapshot(lastEligibilitySnapshotRef.current, governanceEligibilitySnapshot)
    ) {
      return;
    }

    let cancelled = false;

    const syncGovernanceEligibilitySnapshot = async () => {
      const payload = {
        ...governanceEligibilitySnapshot,
        calculatedAt: new Date().toISOString(),
      };

      const { error } = await persistGovernanceEligibilitySnapshot(supabase, payload);

      if (cancelled) return;

      if (error) {
        console.error('Failed to persist governance eligibility snapshot:', error);
        return;
      }

      lastEligibilitySnapshotRef.current = payload;

      const profileEligibilityChanged = profile.is_governance_eligible !== payload.eligible;
      const profileEligibilityTimestampMissing = payload.eligible && !profile.governance_eligible_at;

      if (profileEligibilityChanged || profileEligibilityTimestampMissing) {
        await refreshProfile();
      }
    };

    void syncGovernanceEligibilitySnapshot();

    return () => {
      cancelled = true;
    };
  }, [
    governanceEligibilitySnapshot,
    governanceEligibilityUnavailable,
    loadingGovernanceEligibility,
    profile?.governance_eligible_at,
    profile?.id,
    profile?.is_governance_eligible,
    refreshProfile,
  ]);

  const loadMaturityReview = useCallback(async () => {
    setLoadingMaturityReview(true);

    const scheduledRefreshResponse = await supabase.rpc('capture_scheduled_governance_domain_maturity_snapshots', {
      max_snapshot_age: '12 hours',
      snapshot_source: 'steward_console_refresh',
      snapshot_notes: 'Stale snapshot refresh triggered from governance admin maturity panel',
    });

    if (isMissingMaturityBackend(scheduledRefreshResponse.error)) {
      setMaturityBackendUnavailable(true);
      setLoadingMaturityReview(false);
      return;
    }

    if (scheduledRefreshResponse.error) {
      console.error('Failed to run scheduled maturity refresh helper:', scheduledRefreshResponse.error);
    }

    const [domainsResponse, snapshotsResponse, transitionsResponse] = await Promise.all([
      supabase
        .from('governance_domains')
        .select('*')
        .eq('is_active', true)
        .order('domain_key', { ascending: true }),
      supabase
        .from('governance_domain_maturity_snapshots')
        .select('*')
        .order('measured_at', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('governance_domain_maturity_transitions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    const sharedError = domainsResponse.error || snapshotsResponse.error || transitionsResponse.error;
    if (isMissingMaturityBackend(sharedError)) {
      setMaturityBackendUnavailable(true);
      setLoadingMaturityReview(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load maturity review data:', {
        domainsError: domainsResponse.error,
        snapshotsError: snapshotsResponse.error,
        transitionsError: transitionsResponse.error,
      });
      toast.error('Could not load domain maturity review data.');
      setLoadingMaturityReview(false);
      return;
    }

    const domains = (domainsResponse.data as GovernanceDomainRow[]) || [];
    const snapshots = (snapshotsResponse.data as GovernanceDomainMaturitySnapshotRow[]) || [];
    const transitions = (transitionsResponse.data as GovernanceDomainMaturityTransitionRow[]) || [];

    const latestSnapshots = snapshots.reduce<Record<string, GovernanceDomainMaturitySnapshotRow>>((accumulator, snapshot) => {
      if (!accumulator[snapshot.domain_key]) {
        accumulator[snapshot.domain_key] = snapshot;
      }
      return accumulator;
    }, {});

    const latestTransitions = transitions.reduce<Record<string, GovernanceDomainMaturityTransitionRow>>((accumulator, transition) => {
      if (!accumulator[transition.domain_key]) {
        accumulator[transition.domain_key] = transition;
      }
      return accumulator;
    }, {});

    setMaturityDomains(domains);
    setLatestMaturitySnapshotsByDomain(latestSnapshots);
    setLatestMaturityTransitionsByDomain(latestTransitions);
    setRecentMaturityTransitions(transitions);
    setMaturityBackendUnavailable(false);
    setLoadingMaturityReview(false);
  }, []);

  useEffect(() => {
    void loadMaturityReview();
  }, [loadMaturityReview]);

  const handleRefreshAllMaturitySnapshots = useCallback(async () => {
    if (!profile?.id || maturityBackendUnavailable) return;

    setRefreshingAllMaturitySnapshots(true);

    const { error } = await supabase.rpc('capture_all_governance_domain_maturity_snapshots', {
      snapshot_source: 'steward_manual_refresh',
      measured_by_profile_id: profile.id,
      snapshot_notes: 'Manual snapshot refresh from governance admin maturity panel',
    });

    if (error) {
      console.error('Failed to refresh all maturity snapshots:', error);
      toast.error('Could not refresh domain maturity snapshots.');
      setRefreshingAllMaturitySnapshots(false);
      return;
    }

    await loadMaturityReview();
    setRefreshingAllMaturitySnapshots(false);
    toast.success('Domain maturity snapshots refreshed.');
  }, [loadMaturityReview, maturityBackendUnavailable, profile?.id]);

  const handleRefreshDomainMaturitySnapshot = useCallback(async (domainKey: string) => {
    if (!profile?.id || maturityBackendUnavailable) return;

    setRefreshingDomainMaturityKey(domainKey);

    const { error } = await supabase.rpc('capture_governance_domain_maturity_snapshot', {
      requested_domain_key: domainKey,
      snapshot_source: 'steward_manual_refresh',
      measured_by_profile_id: profile.id,
      snapshot_notes: `Manual snapshot refresh from governance admin maturity panel for ${domainKey}`,
    });

    if (error) {
      console.error('Failed to refresh domain maturity snapshot:', { domainKey, error });
      toast.error(`Could not refresh maturity snapshot for ${domainKey}.`);
      setRefreshingDomainMaturityKey(null);
      return;
    }

    await loadMaturityReview();
    setRefreshingDomainMaturityKey(null);
    toast.success(`Domain maturity snapshot refreshed for ${domainKey}.`);
  }, [loadMaturityReview, maturityBackendUnavailable, profile?.id]);

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

  const registerCitizenKey = useCallback(async () => {
    if (!profile?.id) return;

    setGeneratingCitizenKey(true);
    try {
      const signingKey = await generateCitizenSigningKey();
      storeCitizenSigningKey(profile.id, signingKey);

      const { error } = await supabase
        .from('profiles')
        .update({
          citizen_signing_public_key: signingKey.publicKey,
          citizen_signing_key_algorithm: signingKey.algorithm,
          citizen_signing_key_registered_at: signingKey.createdAt,
        })
        .eq('id', profile.id);

      if (error) {
        clearStoredCitizenSigningKey(profile.id);
        console.error('Failed to register citizen signing key:', error);
        toast.error(t('governance.keyRegisterFailed'));
        return;
      }

      await refreshProfile();
      refreshCitizenKeyStatus();
      toast.success(t('governance.keyRegisteredSuccess'));
    } catch (error) {
      console.error('Failed to generate citizen signing key:', error);
      toast.error(t('governance.keyRegisterFailed'));
    } finally {
      setGeneratingCitizenKey(false);
    }
  }, [profile?.id, refreshCitizenKeyStatus, refreshProfile, t]);

  const removeLocalCitizenKey = useCallback(() => {
    if (!profile?.id) return;
    clearStoredCitizenSigningKey(profile.id);
    refreshCitizenKeyStatus();
    toast.success(t('governance.keyRemovedSuccess'));
  }, [profile?.id, refreshCitizenKeyStatus, t]);

  const getSigningGuardState = useCallback(() => {
    if (!profile?.id) {
      return { shouldBlock: false, localKey: null as ReturnType<typeof readStoredCitizenSigningKey>, reason: null as string | null };
    }

    const localKey = readStoredCitizenSigningKey(profile.id);
    const registeredPublicKey = profile.citizen_signing_public_key ?? null;

    if (!registeredPublicKey) {
      return { shouldBlock: false, localKey, reason: null };
    }

    if (!localKey) {
      return { shouldBlock: true, localKey: null, reason: t('governance.localKeyMissingBlocking') };
    }

    if (localKey.publicKey !== registeredPublicKey) {
      return { shouldBlock: true, localKey, reason: t('governance.keyMismatchBlocking') };
    }

    return { shouldBlock: false, localKey, reason: null };
  }, [profile?.citizen_signing_public_key, profile?.id, t]);

  const getGovernanceActionGuardState = useCallback(() => {
    const signingGuard = getSigningGuardState();
    if (signingGuard.shouldBlock) {
      return { shouldBlock: true, reason: signingGuard.reason };
    }

    if (loadingGovernanceEligibility) {
      return { shouldBlock: true, reason: t('governance.eligibilityLoading') };
    }

    if (governanceEligibilityUnavailable) {
      return { shouldBlock: true, reason: t('governance.eligibilityUnavailable') };
    }

    if (!governanceEligibility.eligible) {
      return {
        shouldBlock: true,
        reason: governanceRequirementMessages[0] || t('governance.eligibilityUnavailable'),
      };
    }

    return { shouldBlock: false, reason: null as string | null };
  }, [
    getSigningGuardState,
    governanceEligibility.eligible,
    governanceEligibilityUnavailable,
    governanceRequirementMessages,
    loadingGovernanceEligibility,
    t,
  ]);

  const persistGovernanceIntent = useCallback(async (payload: {
    actionScope: string;
    targetId?: string | null;
    body: Record<string, Json>;
  }) => {
    const guard = getSigningGuardState();

    if (!profile?.id || !guard.localKey || !profile.citizen_signing_public_key) {
      return {
        signed: false,
        intentId: null as string | null,
        payloadHash: null as string | null,
      };
    }

    const intentEnvelope = await signGovernanceIntent(
      {
        actorProfileId: profile.id,
        actionScope: payload.actionScope,
        targetId: payload.targetId ?? null,
        payload: payload.body,
      },
      guard.localKey,
    );

    const { data, error } = await supabase
      .from('governance_action_intents')
      .insert({
        actor_id: profile.id,
        action_scope: intentEnvelope.actionScope,
        target_id: intentEnvelope.targetId ?? null,
        payload: intentEnvelope.payload as Json,
        payload_hash: intentEnvelope.payloadHash,
        signature: intentEnvelope.signature,
        public_key: intentEnvelope.publicKey,
        key_algorithm: intentEnvelope.algorithm,
        client_created_at: intentEnvelope.clientCreatedAt,
      })
      .select('*')
      .single();

    if (error) {
      const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
      if (error.code === '42P01' || error.code === 'PGRST205' || message.includes('governance_action_intents')) {
        setGovernanceIntentBackendUnavailable(true);
        return {
          signed: false,
          intentId: null,
          payloadHash: intentEnvelope.payloadHash,
        };
      }

      throw error;
    }

    const intentRow = data as GovernanceIntentRow;
    return {
      signed: true,
      intentId: intentRow.id,
      payloadHash: intentEnvelope.payloadHash,
    };
  }, [getSigningGuardState, profile?.citizen_signing_public_key, profile?.id]);

  const handleSave = async () => {
    persistPolicyState(form);
    setSavedAt(new Date().toISOString());

    if (!profile?.id || governanceBackendUnavailable) return;

    const actionGuard = getGovernanceActionGuardState();
    if (actionGuard.shouldBlock) {
      toast.error(actionGuard.reason || t('governance.keyRequired'));
      return;
    }

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

    let signingOutcome = {
      signed: false,
      intentId: null as string | null,
      payloadHash: null as string | null,
    };

    try {
      signingOutcome = await persistGovernanceIntent({
        actionScope: 'monetary_policy.save',
        targetId: savedPolicy.id,
        body: {
          policy_name: savedPolicy.policy_name,
          version: savedPolicy.version,
          policy_json: form,
          projected_quarterly_ceiling: projectedQuarterlyCeiling,
          actor_governance_score: governanceScore,
          actor_influence_weight: governanceEligibility.influenceWeight,
          actor_is_verified: Boolean(profile?.is_verified),
          actor_mobile_native: isNativeMobileGovernanceDevice,
        },
      });
    } catch (error) {
      console.error('Failed to persist signed governance intent:', error);
      toast.error(t('governance.errors.signedIntentFailed'));
    }

    await persistAuditEvent({
      policyProfileId: savedPolicy.id,
      eventType: 'policy_saved',
      body: {
        projected_quarterly_ceiling: projectedQuarterlyCeiling,
        inflation_target: form.inflationTarget,
        signed_intent_id: signingOutcome.intentId,
        signed_payload_hash: signingOutcome.payloadHash,
        actor_governance_score: governanceScore,
        actor_influence_weight: governanceEligibility.influenceWeight,
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

    toast.success(signingOutcome.signed ? t('governance.saved') : t('governance.unsignedFallbackSaved'));
    setSavingPolicy(false);
  };

  const handleRecordApproval = async () => {
    if (!profile?.id || !activePolicyId || governanceBackendUnavailable) return;

    const actionGuard = getGovernanceActionGuardState();
    if (actionGuard.shouldBlock) {
      toast.error(actionGuard.reason || t('governance.keyRequired'));
      return;
    }

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

    let signingOutcome = {
      signed: false,
      intentId: null as string | null,
      payloadHash: null as string | null,
    };

    try {
      signingOutcome = await persistGovernanceIntent({
        actionScope: 'monetary_policy.approval',
        targetId: activePolicyId,
        body: {
          approval_class: approvalClass,
          decision: approvalDecision,
          notes: approvalNotes || null,
          actor_governance_score: governanceScore,
          actor_influence_weight: governanceEligibility.influenceWeight,
          actor_is_verified: Boolean(profile?.is_verified),
          actor_mobile_native: isNativeMobileGovernanceDevice,
        },
      });
    } catch (error) {
      console.error('Failed to persist signed governance intent:', error);
      toast.error(t('governance.errors.signedIntentFailed'));
    }

    await persistAuditEvent({
      policyProfileId: activePolicyId,
      eventType: 'approval_recorded',
      body: {
        approval_class: approvalClass,
        decision: approvalDecision,
        signed_intent_id: signingOutcome.intentId,
        signed_payload_hash: signingOutcome.payloadHash,
        actor_governance_score: governanceScore,
        actor_influence_weight: governanceEligibility.influenceWeight,
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
    toast.success(signingOutcome.signed ? t('governance.approvalRecorded') : t('governance.unsignedApprovalRecorded'));
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

  const formatTimestamp = (value: string | null) => {
    if (!value) return '—';
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
          <GovernanceEligibilityCard
            governanceEligibility={governanceEligibility}
            governanceEndorsementCount={governanceEndorsementCount}
            governanceRequirementMessages={governanceRequirementMessages}
            governanceScore={governanceScore}
            isNativeMobileGovernanceDevice={isNativeMobileGovernanceDevice}
            loadingGovernanceEligibility={loadingGovernanceEligibility}
            profileIsVerified={profile?.is_verified}
            t={t}
            governanceEligibilityUnavailable={governanceEligibilityUnavailable}
            minGovernanceScore={MIN_GOVERNANCE_SCORE}
          />

          <GovernanceKeyManagerCard
            citizenKeyFingerprint={citizenKeyFingerprint}
            citizenKeyMismatch={citizenKeyMismatch}
            generatingCitizenKey={generatingCitizenKey}
            governanceIntentBackendUnavailable={governanceIntentBackendUnavailable}
            hasLocalCitizenKey={hasLocalCitizenKey}
            profileId={profile?.id}
            registeredPublicKey={profile?.citizen_signing_public_key}
            t={t}
            onRegisterCitizenKey={() => void registerCitizenKey()}
            onRemoveLocalCitizenKey={removeLocalCitizenKey}
          />

          <GovernancePolicyFormCard
            form={form}
            loadingRemoteState={loadingRemoteState}
            savedAt={savedAt}
            savingPolicy={savingPolicy}
            t={t}
            isBlocked={getGovernanceActionGuardState().shouldBlock}
            onSave={() => void handleSave()}
            onUpdateField={updateField}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-3 lg:grid-cols-2"
        >
          <GovernanceInsightsGrid
            policySignals={policySignals}
            projectedQuarterlyCeiling={projectedQuarterlyCeiling}
            t={t}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="grid gap-3 lg:grid-cols-2"
        >
          <GovernanceApprovalCard
            activePolicyId={activePolicyId}
            approvalClass={approvalClass}
            approvalDecision={approvalDecision}
            approvalNotes={approvalNotes}
            approvalSummary={approvalSummary}
            isBlocked={getGovernanceActionGuardState().shouldBlock}
            loadingRemoteState={loadingRemoteState}
            recordingApproval={recordingApproval}
            t={t}
            onRecordApproval={() => void handleRecordApproval()}
            onSetApprovalClass={setApprovalClass}
            onSetApprovalDecision={setApprovalDecision}
            onSetApprovalNotes={setApprovalNotes}
          />

          <GovernanceAuditCard
            auditRows={auditRows}
            formatTimestamp={formatTimestamp}
            t={t}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <GovernanceMaturityReviewCard
            domains={maturityDomains}
            latestSnapshotsByDomain={latestMaturitySnapshotsByDomain}
            latestTransitionsByDomain={latestMaturityTransitionsByDomain}
            recentTransitions={recentMaturityTransitions}
            loading={loadingMaturityReview}
            backendUnavailable={maturityBackendUnavailable}
            refreshingAll={refreshingAllMaturitySnapshots}
            refreshingDomainKey={refreshingDomainMaturityKey}
            formatTimestamp={formatTimestamp}
            onRefreshAll={() => void handleRefreshAllMaturitySnapshots()}
            onRefreshDomain={(domainKey) => void handleRefreshDomainMaturitySnapshot(domainKey)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <GovernanceActivationReviewCard
            reviews={activationReviews}
            demographicSnapshots={activationDemographicSnapshots}
            latestEvidenceByReviewId={latestActivationEvidenceByReviewId}
            latestDecisionByReviewId={latestActivationDecisionByReviewId}
            loading={loadingActivationReview}
            backendUnavailable={activationReviewBackendUnavailable}
            refreshingAllDemographics={refreshingAllActivationDemographics}
            refreshingScopeKey={refreshingActivationScopeKey}
            savingDemographicSnapshot={savingActivationDemographicSnapshot}
            recordingDecisionReviewId={recordingActivationDecisionReviewId}
            formatTimestamp={formatTimestamp}
            onRefreshAllDemographics={() => void handleRefreshAllActivationDemographics()}
            onRefreshScopeDemographics={(scopeType, countryCode) =>
              void handleRefreshActivationScopeDemographics(scopeType, countryCode)
            }
            onSaveDemographicSnapshot={(draft) => void handleSaveActivationDemographicSnapshot(draft)}
            onRecordDecision={(args) => void handleRecordActivationDecision(args)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <GovernanceGuardianMultisigCard
            loading={loadingGuardianMultisig}
            backendUnavailable={guardianMultisigBackendUnavailable}
            savingPolicy={savingGuardianPolicy}
            addingSigner={addingGuardianSigner}
            togglingSignerId={togglingSignerId}
            policy={guardianPolicy}
            signers={guardianSigners}
            activeSignerCount={activeSignerCount}
            formatTimestamp={formatTimestamp}
            onRefresh={() => void refreshGuardianMultisig()}
            onSavePolicy={(draft) => void saveGuardianPolicy(draft)}
            onAddSigner={(draft) => void addGuardianSigner(draft)}
            onSetSignerActive={(signerId, isActive) => void setGuardianSignerActive(signerId, isActive)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30 }}
        >
          <GovernancePublicAuditAnchoringCard
            batches={publicAuditBatches}
            chainStatus={publicAuditChainStatus}
            loading={loadingPublicAudit}
            backendUnavailable={publicAuditBackendUnavailable}
            creatingBatch={creatingPublicAuditBatch}
            recordingAnchor={recordingPublicAuditAnchor}
            anchorNetwork={publicAuditAnchorNetwork}
            anchorReference={publicAuditAnchorReference}
            formatTimestamp={formatTimestamp}
            onCreateBatch={() => void handleCapturePublicAuditBatch()}
            onRecordAnchor={() => void handleRecordLatestPublicAuditAnchor()}
            onAnchorNetworkChange={setPublicAuditAnchorNetwork}
            onAnchorReferenceChange={setPublicAuditAnchorReference}
          />
        </motion.div>
      </div>
    </AppLayout>
  );
}
