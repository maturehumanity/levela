import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock3, Landmark, Loader2, Vote, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { GovernanceGuardianSignoffCard } from '@/components/governance/GovernanceGuardianSignoffCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { coerceCitizenshipStatus, deriveProjectedCitizenshipStatus } from '@/lib/civic-status';
import {
  MIN_GOVERNANCE_SCORE,
  evaluateGovernanceEligibility,
  isNativeGovernanceApp,
  normalizeGovernanceScoreForRole,
  type GovernanceEligibilityReason,
} from '@/lib/governance-eligibility';
import {
  applyGovernanceProposalExecution,
  buildGovernanceProposalExecutionMetadata,
  describeGovernanceProposalExecution,
  getGovernanceExecutionActionLabelKey,
  getGovernanceProposalTypeForExecutionAction,
  readGovernanceProposalExecutionSpec,
  validateGovernanceExecutionDraft,
} from '@/lib/governance-execution';
import {
  persistGovernanceEligibilitySnapshot,
  sameGovernanceEligibilitySnapshot,
  type GovernanceEligibilitySnapshotPayload,
} from '@/lib/governance-eligibility-snapshots';
import {
  computeGovernanceTimingWindow,
  getGovernanceDecisionClassLabelKey,
  getGovernanceProposalStatusLabelKey,
  getGovernanceVoteChoiceLabelKey,
  resolveGovernanceProposal,
} from '@/lib/governance-proposals';
import {
  readGovernanceExecutionThresholdRuleFromMetadata,
  resolveGovernanceExecutionThresholdRule,
  serializeGovernanceExecutionThresholdRule,
  toGovernanceProposalResolutionThresholds,
} from '@/lib/governance-execution-thresholds';
import {
  getGovernanceSanctionAppealStatusLabelKey,
  getGovernanceSanctionScopeLabelKey,
  getGovernanceSanctionScopeOptionFromRow,
  governanceSanctionBlocksScope,
  isAppealOpen,
  isGovernanceSanctionCurrentlyActive,
} from '@/lib/governance-sanctions';
import {
  buildGovernanceImplementationQueue,
  getGovernanceImplementationStatusClassName,
  getGovernanceImplementationStatusLabelKey,
  getGovernanceUnitLabelKey,
  type GovernanceExecutionUnitRow,
} from '@/lib/governance-implementation';
import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  readGovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  type GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
} from '@/lib/governance-public-audit-verifiers';
import { createEmptyGovernanceProposalDraft } from '@/lib/governance-proposal-draft';
import { calculateLevelaScore, type Endorsement } from '@/lib/scoring';
import type { PillarId } from '@/lib/constants';

const GovernanceProposalComposer = lazy(() =>
  import('@/components/governance/GovernanceProposalComposer').then((module) => ({
    default: module.GovernanceProposalComposer,
  })),
);

type ProposalRow = Database['public']['Tables']['governance_proposals']['Row'];
type VoteRow = Database['public']['Tables']['governance_proposal_votes']['Row'];
type EventRow = Database['public']['Tables']['governance_proposal_events']['Row'];
type ExecutionUnitMembershipRow = Database['public']['Tables']['governance_execution_unit_memberships']['Row'];
type ProposalImplementationRow = Database['public']['Tables']['governance_proposal_implementations']['Row'];
type GovernanceSanctionRow = Database['public']['Tables']['governance_sanctions']['Row'];
type GovernanceSanctionAppealRow = Database['public']['Tables']['governance_sanction_appeals']['Row'];
type MonetaryPolicyProfileRow = Database['public']['Tables']['monetary_policy_profiles']['Row'];
type ContentItemRow = Pick<
  Database['public']['Tables']['content_items']['Row'],
  'id' | 'title' | 'review_status' | 'content_type' | 'professional_domain' | 'source_table'
>;
type ProfileDirectoryRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'username' | 'role' | 'is_verified' | 'is_active_citizen'
>;

const FOUNDATION_CERTIFICATION_ID = 'civic_foundations';

async function resolveGovernanceExecutionNotReadyMessage(
  proposalId: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): Promise<string> {
  const [thresholdRes, guardianRes, federationRes, relayRes] = await Promise.all([
    supabase.rpc('governance_proposal_meets_execution_threshold', { target_proposal_id: proposalId }),
    supabase.rpc('governance_proposal_meets_guardian_signoff', { target_proposal_id: proposalId }),
    supabase.rpc('governance_proposal_meets_verifier_federation_distribution_gate', { target_proposal_id: proposalId }),
    supabase.rpc('governance_proposal_meets_guardian_relay_distribution_gate', { target_proposal_id: proposalId }),
  ]);
  const gateError = thresholdRes.error || guardianRes.error || federationRes.error || relayRes.error;
  if (gateError) {
    console.warn('Could not evaluate individual execution readiness gates:', gateError);
    return t('governanceHub.executeNotReady');
  }
  if (!thresholdRes.data) return t('governanceHub.executeNotReadyThreshold');
  if (!guardianRes.data) return t('governanceHub.executeNotReadyGuardian');
  if (!federationRes.data) return t('governanceHub.executeNotReadyFederationDistribution');
  if (!relayRes.data) return t('governanceHub.executeNotReadyGuardianRelay');
  return t('governanceHub.executeNotReady');
}

function isMissingGovernanceProposalBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('governance_proposal')
    || message.includes('governance_execution')
    || message.includes('guardian_signoff')
    || message.includes('governance_proposal_guardian_approvals')
  );
}

function isMissingGovernanceSanctionsBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || message.includes('governance_sanction')
  );
}

export default function Governance() {
  const { profile, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const [proposalDraft, setProposalDraft] = useState(createEmptyGovernanceProposalDraft);
  const [governanceScore, setGovernanceScore] = useState<number | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [eligibilityUnavailable, setEligibilityUnavailable] = useState(false);
  const [eligibleCitizenCount, setEligibleCitizenCount] = useState(0);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [executionUnits, setExecutionUnits] = useState<GovernanceExecutionUnitRow[]>([]);
  const [unitMemberships, setUnitMemberships] = useState<ExecutionUnitMembershipRow[]>([]);
  const [implementations, setImplementations] = useState<ProposalImplementationRow[]>([]);
  const [monetaryPolicyProfiles, setMonetaryPolicyProfiles] = useState<MonetaryPolicyProfileRow[]>([]);
  const [contentItems, setContentItems] = useState<ContentItemRow[]>([]);
  const [profileDirectory, setProfileDirectory] = useState<ProfileDirectoryRow[]>([]);
  const [loadingHub, setLoadingHub] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [isGuardianSigner, setIsGuardianSigner] = useState(false);
  const [sanctionsBackendUnavailable, setSanctionsBackendUnavailable] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [executingImplementationId, setExecutingImplementationId] = useState<string | null>(null);
  const [sanctions, setSanctions] = useState<GovernanceSanctionRow[]>([]);
  const [appeals, setAppeals] = useState<GovernanceSanctionAppealRow[]>([]);
  const [submittingAppealForSanctionId, setSubmittingAppealForSanctionId] = useState<string | null>(null);
  const [appealDraftBySanctionId, setAppealDraftBySanctionId] = useState<Record<string, { reason: string; evidence: string }>>({});
  const [lastSnapshot, setLastSnapshot] = useState<GovernanceEligibilitySnapshotPayload | null>(null);
  const [verifierFederationExecutionGate, setVerifierFederationExecutionGate] = useState<{
    policyRequiresFederationDistribution: boolean;
    distributionGateMet: boolean;
    federationOps: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
  } | null>(null);
  const isNativeMobileGovernanceDevice = useMemo(() => isNativeGovernanceApp(), []);

  const projectedCitizenshipStatus = useMemo(
    () => deriveProjectedCitizenshipStatus(profile?.role, Boolean(profile?.is_verified)),
    [profile?.is_verified, profile?.role],
  );
  const effectiveCitizenshipStatus = useMemo(
    () => coerceCitizenshipStatus(profile?.citizenship_status, projectedCitizenshipStatus),
    [profile?.citizenship_status, projectedCitizenshipStatus],
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

  const requirementMessages = useMemo(() => {
    const messageByReason: Record<GovernanceEligibilityReason, string> = {
      mobile_app_required: t('governance.requirementMobile'),
      verified_required: t('governance.requirementVerified'),
      minimum_score_required: t('governance.requirementScore'),
      score_unavailable: t('governance.requirementScoreUnavailable'),
    };

    return governanceEligibility.reasons.map((reason) => messageByReason[reason]);
  }, [governanceEligibility.reasons, t]);

  const eligibilitySnapshot = useMemo<GovernanceEligibilitySnapshotPayload | null>(() => {
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

  useEffect(() => {
    let cancelled = false;

    const loadGovernanceEligibility = async () => {
      if (!profile?.id) {
        setGovernanceScore(null);
        setLoadingEligibility(false);
        return;
      }

      setLoadingEligibility(true);

      const { data, error } = await supabase
        .from('endorsements')
        .select('id, endorser_id, endorsed_id, pillar, stars, comment, created_at')
        .eq('endorsed_id', profile.id)
        .eq('is_hidden', false);

      if (cancelled) return;

      if (error) {
        console.error('Failed to load governance eligibility score:', error);
        setGovernanceScore(null);
        setEligibilityUnavailable(true);
        setLoadingEligibility(false);
        return;
      }

      const typedEndorsements = ((data || []) as Endorsement[]).map((item) => ({
        ...item,
        pillar: item.pillar as PillarId,
      }));
      const computedScore = calculateLevelaScore(typedEndorsements);
      const normalizedScore = normalizeGovernanceScoreForRole(profile.role, computedScore.overall);

      setGovernanceScore(normalizedScore);
      setEligibilityUnavailable(false);
      setLoadingEligibility(false);
    };

    void loadGovernanceEligibility();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (!eligibilitySnapshot || loadingEligibility || eligibilityUnavailable) return;
    if (lastSnapshot && sameGovernanceEligibilitySnapshot(lastSnapshot, eligibilitySnapshot)) return;

    let cancelled = false;

    const syncSnapshot = async () => {
      const payload = {
        ...eligibilitySnapshot,
        calculatedAt: new Date().toISOString(),
      };

      const { error } = await persistGovernanceEligibilitySnapshot(supabase, payload);
      if (cancelled) return;

      if (error) {
        console.error('Failed to persist governance eligibility snapshot:', error);
        return;
      }

      setLastSnapshot(payload);

      if (profile?.is_governance_eligible !== payload.eligible) {
        await refreshProfile();
      }
    };

    void syncSnapshot();

    return () => {
      cancelled = true;
    };
  }, [
    eligibilitySnapshot,
    eligibilityUnavailable,
    lastSnapshot,
    loadingEligibility,
    profile?.is_governance_eligible,
    refreshProfile,
  ]);

  const loadSanctionsAndAppeals = useCallback(async () => {
    if (!profile?.id) {
      setSanctions([]);
      setAppeals([]);
      setSanctionsBackendUnavailable(false);
      return;
    }

    const [sanctionsResponse, appealsResponse] = await Promise.all([
      supabase
        .from('governance_sanctions')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('governance_sanction_appeals')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false }),
    ]);

    const sanctionsError = sanctionsResponse.error;
    const appealsError = appealsResponse.error;
    const missingBackend = isMissingGovernanceSanctionsBackend(sanctionsError) || isMissingGovernanceSanctionsBackend(appealsError);

    if (missingBackend) {
      setSanctionsBackendUnavailable(true);
      return;
    }

    if (sanctionsError || appealsError) {
      console.error('Failed to load governance sanctions/appeals:', {
        sanctionsError,
        appealsError,
      });
      return;
    }

    setSanctions((sanctionsResponse.data || []) as GovernanceSanctionRow[]);
    setAppeals((appealsResponse.data || []) as GovernanceSanctionAppealRow[]);
    setSanctionsBackendUnavailable(false);
  }, [profile?.id]);

  useEffect(() => {
    void loadSanctionsAndAppeals();
  }, [loadSanctionsAndAppeals]);

  const queueImplementationsForProposal = useCallback(async (
    proposal: ProposalRow,
    actorId: string | null,
    availableUnitsByKey: Record<string, GovernanceExecutionUnitRow>,
    existingImplementations: ProposalImplementationRow[],
  ) => {
    if (proposal.status !== 'approved') return false;
    if (existingImplementations.length > 0) return false;

    const queueEntries = buildGovernanceImplementationQueue({
      proposal,
      createdBy: actorId,
      unitsByKey: availableUnitsByKey,
    });

    if (!queueEntries.length) {
      return false;
    }

    const { error: implementationError } = await supabase
      .from('governance_proposal_implementations')
      .upsert(queueEntries, { onConflict: 'proposal_id,unit_id' });

    if (implementationError) {
      console.error('Failed to queue governance implementation records:', implementationError);
      return false;
    }

    const unitKeyById = Object.fromEntries(
      Object.values(availableUnitsByKey).map((unit) => [unit.id, unit.unit_key]),
    ) as Record<string, string>;

    const eventsToInsert = queueEntries.map((entry) => ({
      proposal_id: proposal.id,
      actor_id: actorId,
      event_type: 'implementation.queued',
      payload: {
        unit_id: entry.unit_id,
        unit_key: unitKeyById[entry.unit_id] || null,
        status: 'queued',
      },
    }));

    const { error: eventError } = await supabase.from('governance_proposal_events').insert(eventsToInsert);

    if (eventError) {
      console.error('Failed to record implementation queue events:', eventError);
    }

    return true;
  }, []);

  const finalizeProposalIfReady = useCallback(async (
    proposal: ProposalRow,
    proposalVotes: VoteRow[],
    actorId: string | null,
    availableUnitsByKey: Record<string, GovernanceExecutionUnitRow>,
    existingImplementations: ProposalImplementationRow[],
  ) => {
    const executionSpec = readGovernanceProposalExecutionSpec(proposal.metadata);
    const thresholdRule = readGovernanceExecutionThresholdRuleFromMetadata(proposal.metadata)
      || resolveGovernanceExecutionThresholdRule({
        actionType: executionSpec.actionType,
        decisionClass: proposal.decision_class,
      });
    const resolution = resolveGovernanceProposal({
      proposal,
      votes: proposalVotes,
      thresholds: toGovernanceProposalResolutionThresholds(thresholdRule),
    });
    if (!resolution.finalizable) return false;

    if (resolution.status === 'approved') {
      const { data: meetsGuardianSignoff, error: guardianSignoffError } = await supabase.rpc(
        'governance_proposal_meets_guardian_signoff',
        { target_proposal_id: proposal.id },
      );

      if (guardianSignoffError) {
        console.error('Failed to evaluate guardian signoff readiness:', guardianSignoffError);
        return false;
      }

      if (!meetsGuardianSignoff) {
        return false;
      }
    }

    const { error: updateError } = await supabase
      .from('governance_proposals')
      .update({
        status: resolution.status,
        resolved_at: new Date().toISOString(),
        final_decision_summary: resolution.summary,
      })
      .eq('id', proposal.id)
      .eq('status', 'open');

    if (updateError) {
      console.error('Failed to finalize governance proposal:', updateError);
      return false;
    }

    const { error: eventError } = await supabase
      .from('governance_proposal_events')
      .insert({
        proposal_id: proposal.id,
        actor_id: actorId,
        event_type: 'proposal.finalized',
        payload: {
          status: resolution.status,
          summary: resolution.summary,
          tally: resolution.tally,
        },
      });

    if (eventError) {
      console.error('Failed to record proposal finalization event:', eventError);
    }

    if (resolution.status === 'approved') {
      await queueImplementationsForProposal(
        {
          ...proposal,
          status: resolution.status,
        },
        actorId,
        availableUnitsByKey,
        existingImplementations,
      );
    }

    return true;
  }, [queueImplementationsForProposal]);

  const loadGovernanceHub = useCallback(async () => {
    setLoadingHub(true);

    const [
      proposalResponse,
      voteResponse,
      eventResponse,
      eligibleCountResponse,
      profileDirectoryResponse,
      monetaryPoliciesResponse,
      contentItemsResponse,
      executionUnitsResponse,
      membershipsResponse,
      implementationsResponse,
      guardianSignerResponse,
    ] = await Promise.all([
      supabase.from('governance_proposals').select('*').order('created_at', { ascending: false }),
      supabase.from('governance_proposal_votes').select('*').order('created_at', { ascending: false }),
      supabase.from('governance_proposal_events').select('*').order('created_at', { ascending: false }).limit(60),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_governance_eligible', true)
        .eq('is_active_citizen', true)
        .is('deleted_at', null),
      supabase
        .from('profiles')
        .select('id, full_name, username, role, is_verified, is_active_citizen')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase.from('monetary_policy_profiles').select('*').order('updated_at', { ascending: false }),
      supabase
        .from('content_items')
        .select('id, title, review_status, content_type, professional_domain, source_table')
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase.from('governance_execution_units').select('*').eq('is_active', true).order('created_at', { ascending: true }),
      supabase
        .from('governance_execution_unit_memberships')
        .select('*')
        .eq('is_active', true)
        .order('assigned_at', { ascending: true }),
      supabase
        .from('governance_proposal_implementations')
        .select('*')
        .order('assigned_at', { ascending: false }),
      supabase.rpc('current_profile_is_guardian_signer'),
    ]);

    const primaryError =
      proposalResponse.error
      || voteResponse.error
      || eventResponse.error
      || eligibleCountResponse.error
      || profileDirectoryResponse.error
      || monetaryPoliciesResponse.error
      || contentItemsResponse.error
      || executionUnitsResponse.error
      || membershipsResponse.error
      || implementationsResponse.error
      || guardianSignerResponse.error;

    if (primaryError && isMissingGovernanceProposalBackend(primaryError)) {
      setBackendUnavailable(true);
      setVerifierFederationExecutionGate(null);
      setLoadingHub(false);
      return;
    }

    if (primaryError) {
      console.error('Failed to load governance hub:', {
        proposals: proposalResponse.error,
        votes: voteResponse.error,
        events: eventResponse.error,
        eligibleCount: eligibleCountResponse.error,
        profileDirectory: profileDirectoryResponse.error,
        monetaryPolicies: monetaryPoliciesResponse.error,
        contentItems: contentItemsResponse.error,
        executionUnits: executionUnitsResponse.error,
        memberships: membershipsResponse.error,
        implementations: implementationsResponse.error,
        guardianSigner: guardianSignerResponse.error,
      });
      toast.error(t('governanceHub.loadFailed'));
      setVerifierFederationExecutionGate(null);
      setLoadingHub(false);
      return;
    }

    const nextProposals = (proposalResponse.data || []) as ProposalRow[];
    const nextVotes = (voteResponse.data || []) as VoteRow[];
    const nextEvents = (eventResponse.data || []) as EventRow[];
    const nextEligibleCitizenCount = eligibleCountResponse.count || 0;
    const nextProfileDirectory = (profileDirectoryResponse.data || []) as ProfileDirectoryRow[];
    const nextMonetaryPolicyProfiles = (monetaryPoliciesResponse.data || []) as MonetaryPolicyProfileRow[];
    const nextContentItems = (contentItemsResponse.data || []) as ContentItemRow[];
    const nextExecutionUnits = (executionUnitsResponse.data || []) as GovernanceExecutionUnitRow[];
    const nextUnitMemberships = (membershipsResponse.data || []) as ExecutionUnitMembershipRow[];
    const nextImplementations = (implementationsResponse.data || []) as ProposalImplementationRow[];
    const availableUnitsByKey = Object.fromEntries(
      nextExecutionUnits.map((unit) => [unit.unit_key, unit]),
    ) as Record<string, GovernanceExecutionUnitRow>;

    let finalizedAny = false;
    for (const proposal of nextProposals.filter((item) => item.status === 'open')) {
      const proposalVotes = nextVotes.filter((vote) => vote.proposal_id === proposal.id);
      const existingImplementations = nextImplementations.filter((item) => item.proposal_id === proposal.id);
      const finalized = await finalizeProposalIfReady(
        proposal,
        proposalVotes,
        profile?.id ?? null,
        availableUnitsByKey,
        existingImplementations,
      );
      finalizedAny = finalizedAny || finalized;
    }

    let queuedAny = false;
    for (const proposal of nextProposals.filter((item) => item.status === 'approved')) {
      const existingImplementations = nextImplementations.filter((item) => item.proposal_id === proposal.id);
      const queued = await queueImplementationsForProposal(
        proposal,
        profile?.id ?? null,
        availableUnitsByKey,
        existingImplementations,
      );
      queuedAny = queuedAny || queued;
    }

    if (finalizedAny || queuedAny) {
      await loadGovernanceHub();
      return;
    }

    setProposals(nextProposals);
    setVotes(nextVotes);
    setEvents(nextEvents);
    setProfileDirectory(nextProfileDirectory);
    setMonetaryPolicyProfiles(nextMonetaryPolicyProfiles);
    setContentItems(nextContentItems);
    setExecutionUnits(nextExecutionUnits);
    setUnitMemberships(nextUnitMemberships);
    setImplementations(nextImplementations);
    setEligibleCitizenCount(nextEligibleCitizenCount);
    setIsGuardianSigner(Boolean(guardianSignerResponse.data));
    setBackendUnavailable(false);

    const gateProposalId = nextProposals[0]?.id ?? '00000000-0000-0000-0000-000000000000';
    const [failoverSummaryResponse, federationDistributionGateResponse, federationOpsSummaryResponse] = await Promise.all([
      supabase.rpc('governance_public_audit_verifier_mirror_failover_policy_summary', { requested_policy_key: 'default' }),
      supabase.rpc('governance_proposal_meets_verifier_federation_distribution_gate', { target_proposal_id: gateProposalId }),
      supabase.rpc('governance_public_audit_verifier_mirror_federation_operations_summary', {
        requested_policy_key: 'default',
        requested_lookback_hours: 24,
        requested_alert_sla_hours: 12,
      }),
    ]);
    const verifierGateError = failoverSummaryResponse.error || federationDistributionGateResponse.error;
    if (verifierGateError && isMissingPublicAuditVerifierBackend(verifierGateError)) {
      setVerifierFederationExecutionGate(null);
    } else if (verifierGateError) {
      console.warn('Could not load verifier federation execution gate context for governance hub:', verifierGateError);
      setVerifierFederationExecutionGate(null);
    } else {
      const failoverSummary = readGovernancePublicAuditVerifierMirrorFailoverPolicySummary(failoverSummaryResponse.data);
      let federationOps: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null = null;
      if (federationOpsSummaryResponse.error) {
        if (!isMissingPublicAuditVerifierBackend(federationOpsSummaryResponse.error)) {
          console.warn('Could not load federation operations summary for governance hub:', federationOpsSummaryResponse.error);
        }
      } else {
        federationOps = readGovernancePublicAuditVerifierMirrorFederationOperationsSummary(federationOpsSummaryResponse.data);
      }
      setVerifierFederationExecutionGate({
        policyRequiresFederationDistribution: Boolean(failoverSummary?.requireFederationOpsReadiness),
        distributionGateMet: Boolean(federationDistributionGateResponse.data),
        federationOps,
      });
    }

    setLoadingHub(false);
  }, [finalizeProposalIfReady, profile?.id, queueImplementationsForProposal, t]);

  useEffect(() => {
    void loadGovernanceHub();
  }, [loadGovernanceHub]);

  const votesByProposal = useMemo(
    () =>
      votes.reduce<Record<string, VoteRow[]>>((accumulator, vote) => {
        if (!accumulator[vote.proposal_id]) accumulator[vote.proposal_id] = [];
        accumulator[vote.proposal_id].push(vote);
        return accumulator;
      }, {}),
    [votes],
  );
  const implementationsByProposal = useMemo(
    () =>
      implementations.reduce<Record<string, ProposalImplementationRow[]>>((accumulator, implementation) => {
        if (!accumulator[implementation.proposal_id]) accumulator[implementation.proposal_id] = [];
        accumulator[implementation.proposal_id].push(implementation);
        return accumulator;
      }, {}),
    [implementations],
  );
  const unitsById = useMemo(
    () => Object.fromEntries(executionUnits.map((unit) => [unit.id, unit])) as Record<string, GovernanceExecutionUnitRow>,
    [executionUnits],
  );
  const unitsByKey = useMemo(
    () => Object.fromEntries(executionUnits.map((unit) => [unit.unit_key, unit])) as Record<string, GovernanceExecutionUnitRow>,
    [executionUnits],
  );
  const membershipsByUnit = useMemo(
    () =>
      unitMemberships.reduce<Record<string, ExecutionUnitMembershipRow[]>>((accumulator, membership) => {
        if (!accumulator[membership.unit_id]) accumulator[membership.unit_id] = [];
        accumulator[membership.unit_id].push(membership);
        return accumulator;
      }, {}),
    [unitMemberships],
  );
  const profileDirectoryById = useMemo(
    () => Object.fromEntries(profileDirectory.map((entry) => [entry.id, entry])) as Record<string, ProfileDirectoryRow>,
    [profileDirectory],
  );
  const currentUserUnitIds = useMemo(
    () => new Set(unitMemberships.filter((membership) => membership.profile_id === profile?.id).map((membership) => membership.unit_id)),
    [profile?.id, unitMemberships],
  );
  const contentItemsById = useMemo(
    () => Object.fromEntries(contentItems.map((item) => [item.id, item])) as Record<string, ContentItemRow>,
    [contentItems],
  );
  const studyCertificationOptions = useMemo(
    () => [
      {
        key: FOUNDATION_CERTIFICATION_ID,
        label: t('governanceHub.certifications.civicFoundations'),
      },
    ],
    [t],
  );
  const studyCertificationLabelByKey = useMemo(
    () =>
      Object.fromEntries(studyCertificationOptions.map((option) => [option.key, option.label])) as Record<string, string>,
    [studyCertificationOptions],
  );

  const currentUserVotes = useMemo(
    () =>
      votes.reduce<Record<string, VoteRow>>((accumulator, vote) => {
        if (vote.voter_id === profile?.id) accumulator[vote.proposal_id] = vote;
        return accumulator;
      }, {}),
    [profile?.id, votes],
  );
  const activeSanctions = useMemo(
    () => sanctions.filter((sanction) => isGovernanceSanctionCurrentlyActive(sanction)),
    [sanctions],
  );
  const proposalBlockedBySanction = useMemo(
    () => activeSanctions.some((sanction) => governanceSanctionBlocksScope(sanction, 'proposal_create')),
    [activeSanctions],
  );
  const voteBlockedBySanction = useMemo(
    () => activeSanctions.some((sanction) => governanceSanctionBlocksScope(sanction, 'vote')),
    [activeSanctions],
  );
  const executionBlockedBySanction = useMemo(
    () => activeSanctions.some((sanction) => governanceSanctionBlocksScope(sanction, 'execution')),
    [activeSanctions],
  );
  const openAppealsBySanctionId = useMemo(
    () =>
      appeals.reduce<Record<string, GovernanceSanctionAppealRow>>((accumulator, appeal) => {
        if (isAppealOpen(appeal.status) && !accumulator[appeal.sanction_id]) {
          accumulator[appeal.sanction_id] = appeal;
        }
        return accumulator;
      }, {}),
    [appeals],
  );

  const formatDateTime = (value: string | null) => {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const formatProfileLabel = (entry: ProfileDirectoryRow) => {
    const name = entry.full_name?.trim() || entry.username?.trim() || t(`admin.roles.${entry.role}`);
    const statusBits = [
      entry.is_verified ? t('admin.users.verifiedBadge') : t('admin.users.unverifiedBadge'),
      entry.is_active_citizen ? t('admin.users.activeCitizenBadge') : t('governanceHub.notActiveCitizen'),
    ];
    return `${name} (${statusBits.join(' • ')})`;
  };
  const formatContentItemLabel = (item: ContentItemRow) => {
    const title = item.title?.trim() || `${item.content_type} • ${item.professional_domain}`;
    return `${title} (${item.review_status})`;
  };

  const handleCreateProposal = async () => {
    if (!profile?.id) {
      toast.error(t('governanceHub.proposeBlocked'));
      return;
    }

    if (proposalBlockedBySanction) {
      toast.error(t('governanceHub.proposeBlockedBySanction'));
      return;
    }

    if (!governanceEligibility.eligible) {
      toast.error(t('governanceHub.proposeBlocked'));
      return;
    }

    const title = proposalDraft.title.trim();
    const summary = proposalDraft.summary.trim();
    const body = proposalDraft.body.trim();

    if (!title || !summary || !body) {
      toast.error(t('governanceHub.requiredFields'));
      return;
    }

    if (!validateGovernanceExecutionDraft(proposalDraft.execution)) {
      toast.error(t('governanceHub.executionFieldsRequired'));
      return;
    }

    setCreatingProposal(true);

    const thresholdRule = resolveGovernanceExecutionThresholdRule({
      actionType: proposalDraft.execution.actionType,
      decisionClass: proposalDraft.decisionClass,
    });
    const timing = computeGovernanceTimingWindow({
      eligibleVoterCount: Math.max(eligibleCitizenCount, 1),
      minimumQuorum: thresholdRule.minQuorum,
      requireWaitWindow: thresholdRule.requiresWindowClose,
    });

    const executionMetadata = buildGovernanceProposalExecutionMetadata(proposalDraft.execution);

    const proposalInsert: Database['public']['Tables']['governance_proposals']['Insert'] = {
      title,
      summary,
      body,
      decision_class: proposalDraft.decisionClass,
      proposer_id: profile.id,
      proposal_type: getGovernanceProposalTypeForExecutionAction(proposalDraft.execution.actionType),
      eligible_voter_count_snapshot: timing.eligibleVoterCount,
      required_quorum: timing.requiredQuorum,
      bootstrap_mode: timing.bootstrapMode,
      opens_at: timing.opensAt,
      closes_at: timing.closesAt,
      approval_threshold: Math.max(0.5, thresholdRule.minApprovalShare),
      metadata: {
        created_from: 'citizen_governance_hub',
        wait_required: timing.waitRequired,
        execution_threshold: serializeGovernanceExecutionThresholdRule(thresholdRule),
        ...executionMetadata,
      },
    };

    const { data: createdProposal, error: proposalError } = await supabase
      .from('governance_proposals')
      .insert(proposalInsert)
      .select('*')
      .single();

    if (proposalError || !createdProposal) {
      console.error('Failed to create governance proposal:', proposalError);
      toast.error(t('governanceHub.createFailed'));
      setCreatingProposal(false);
      return;
    }

    const { error: eventError } = await supabase.from('governance_proposal_events').insert({
      proposal_id: createdProposal.id,
      actor_id: profile.id,
      event_type: 'proposal.created',
      payload: {
        decision_class: proposalDraft.decisionClass,
        bootstrap_mode: timing.bootstrapMode,
        eligible_voter_count_snapshot: timing.eligibleVoterCount,
        required_quorum: timing.requiredQuorum,
        approval_threshold: Math.max(0.5, thresholdRule.minApprovalShare),
        threshold_approval_class: thresholdRule.approvalClass,
        threshold_requires_window_close: thresholdRule.requiresWindowClose,
        execution_action_type: proposalDraft.execution.actionType,
      },
    });

    if (eventError) {
      console.error('Failed to record proposal creation event:', eventError);
    }

    if (timing.bootstrapMode) {
      const snapshot: Json = {
        governance_score: governanceScore,
        citizenship_status: effectiveCitizenshipStatus,
        is_verified: Boolean(profile.is_verified),
        is_active_citizen: Boolean(profile.is_active_citizen),
      };

      const { error: voteError } = await supabase.from('governance_proposal_votes').upsert(
        {
          proposal_id: createdProposal.id,
          voter_id: profile.id,
          choice: 'approve',
          weight: governanceEligibility.influenceWeight,
          rationale: t('governanceHub.bootstrapApprovalNote'),
          snapshot,
        },
        { onConflict: 'proposal_id,voter_id' },
      );

      if (voteError) {
        console.error('Failed to auto-cast bootstrap approval vote:', voteError);
      } else {
        await supabase.from('governance_proposal_events').insert({
          proposal_id: createdProposal.id,
          actor_id: profile.id,
          event_type: 'vote.recorded',
          payload: {
            choice: 'approve',
            auto_cast: true,
            bootstrap_mode: true,
          },
        });

        await finalizeProposalIfReady(
          createdProposal,
          [
            {
              id: '',
              proposal_id: createdProposal.id,
              voter_id: profile.id,
              choice: 'approve',
              weight: governanceEligibility.influenceWeight,
              rationale: t('governanceHub.bootstrapApprovalNote'),
              snapshot,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          profile.id,
          unitsByKey,
          [],
        );
      }
    }

    setProposalDraft(createEmptyGovernanceProposalDraft());
    toast.success(
      timing.bootstrapMode ? t('governanceHub.createdAndFinalized') : t('governanceHub.created'),
    );
    setCreatingProposal(false);
    await loadGovernanceHub();
  };

  const handleVote = async (proposal: ProposalRow, choice: Database['public']['Enums']['governance_vote_choice']) => {
    if (!profile?.id) {
      toast.error(t('governanceHub.voteBlocked'));
      return;
    }

    if (voteBlockedBySanction) {
      toast.error(t('governanceHub.voteBlockedBySanction'));
      return;
    }

    if (!governanceEligibility.eligible) {
      toast.error(t('governanceHub.voteBlocked'));
      return;
    }

    setVotingProposalId(proposal.id);

    const snapshot: Json = {
      governance_score: governanceScore,
      citizenship_status: effectiveCitizenshipStatus,
      is_verified: Boolean(profile.is_verified),
      is_active_citizen: Boolean(profile.is_active_citizen),
    };

    const { error: voteError } = await supabase.from('governance_proposal_votes').upsert(
      {
        proposal_id: proposal.id,
        voter_id: profile.id,
        choice,
        weight: governanceEligibility.influenceWeight,
        rationale: null,
        snapshot,
      },
      { onConflict: 'proposal_id,voter_id' },
    );

    if (voteError) {
      console.error('Failed to record governance vote:', voteError);
      toast.error(t('governanceHub.voteFailed'));
      setVotingProposalId(null);
      return;
    }

    const { error: eventError } = await supabase.from('governance_proposal_events').insert({
      proposal_id: proposal.id,
      actor_id: profile.id,
      event_type: 'vote.recorded',
      payload: {
        choice,
        weight: governanceEligibility.influenceWeight,
      },
    });

    if (eventError) {
      console.error('Failed to record governance vote event:', eventError);
    }

    const { data: refreshedVotes, error: refreshedVotesError } = await supabase
      .from('governance_proposal_votes')
      .select('*')
      .eq('proposal_id', proposal.id);

    if (!refreshedVotesError) {
      await finalizeProposalIfReady(
        proposal,
        (refreshedVotes || []) as VoteRow[],
        profile.id,
        unitsByKey,
        implementationsByProposal[proposal.id] || [],
      );
    }

    toast.success(t('governanceHub.voteRecorded', { choice: t(getGovernanceVoteChoiceLabelKey(choice)) }));
    setVotingProposalId(null);
    await loadGovernanceHub();
  };

  const handleExecuteImplementation = async (proposal: ProposalRow, implementation: ProposalImplementationRow) => {
    if (executionBlockedBySanction) {
      toast.error(t('governanceHub.executeBlockedBySanction'));
      return;
    }

    if (!profile?.id || !currentUserUnitIds.has(implementation.unit_id)) {
      toast.error(t('governanceHub.executeBlocked'));
      return;
    }

    const executionSpec = readGovernanceProposalExecutionSpec(proposal.metadata);
    if (!executionSpec.autoExecutable) {
      toast.error(t('governanceHub.executeManualOnly'));
      return;
    }

    const { data: executionReady, error: executionReadyError } = await supabase.rpc('governance_proposal_is_execution_ready', {
      target_proposal_id: proposal.id,
    });
    if (executionReadyError) {
      console.error('Failed to evaluate governance execution readiness:', executionReadyError);
      toast.error(t('governanceHub.executeFailed'));
      return;
    }
    if (!executionReady) {
      const detail = await resolveGovernanceExecutionNotReadyMessage(proposal.id, t);
      toast.error(detail);
      return;
    }

    setExecutingImplementationId(implementation.id);

    const startedAt = new Date().toISOString();
    const mergedStartingMetadata = {
      ...((implementation.metadata as Record<string, unknown> | null) || {}),
      execution_action_type: executionSpec.actionType,
      last_started_at: startedAt,
    };

    const { error: startError } = await supabase
      .from('governance_proposal_implementations')
      .update({
        status: 'in_progress',
        started_at: startedAt,
        metadata: mergedStartingMetadata,
      })
      .eq('id', implementation.id);

    if (startError) {
      console.error('Failed to mark governance implementation as in progress:', startError);
      toast.error(t('governanceHub.executeFailed'));
      setExecutingImplementationId(null);
      return;
    }

    await supabase.from('governance_proposal_events').insert({
      proposal_id: proposal.id,
      actor_id: profile.id,
      event_type: 'implementation.started',
      payload: {
        implementation_id: implementation.id,
        unit_id: implementation.unit_id,
        action_type: executionSpec.actionType,
      },
    });

    const executionResult = await applyGovernanceProposalExecution({
      client: supabase,
      spec: executionSpec,
      actorId: profile.id,
      unitsByKey,
    });

    const completedAt = executionResult.status === 'completed' ? new Date().toISOString() : null;
    const mergedResultMetadata = {
      ...mergedStartingMetadata,
      last_execution_status: executionResult.status,
      last_execution_summary: executionResult.summary,
      last_execution_details: executionResult.details,
      last_completed_at: completedAt,
    };

    const { error: finalizeError } = await supabase
      .from('governance_proposal_implementations')
      .update({
        status: executionResult.status,
        completed_at: completedAt,
        metadata: mergedResultMetadata,
      })
      .eq('id', implementation.id);

    if (finalizeError) {
      console.error('Failed to finalize governance implementation execution:', finalizeError);
      toast.error(t('governanceHub.executeFailed'));
      setExecutingImplementationId(null);
      await loadGovernanceHub();
      return;
    }

    const eventType = executionResult.status === 'completed' ? 'implementation.completed' : 'implementation.blocked';

    await Promise.all([
      supabase.from('governance_proposal_events').insert({
        proposal_id: proposal.id,
        actor_id: profile.id,
        event_type: eventType,
        payload: {
          implementation_id: implementation.id,
          unit_id: implementation.unit_id,
          action_type: executionSpec.actionType,
          status: executionResult.status,
          summary: executionResult.summary,
          details: executionResult.details,
        },
      }),
      supabase.from('governance_implementation_logs').insert({
        implementation_id: implementation.id,
        proposal_id: proposal.id,
        actor_id: profile.id,
        execution_status: executionResult.status,
        execution_summary: executionResult.summary,
        details: executionResult.details,
      }),
    ]);

    toast.success(
      executionResult.status === 'completed'
        ? t('governanceHub.executeCompleted')
        : t('governanceHub.executeBlockedResult'),
    );
    setExecutingImplementationId(null);
    await loadGovernanceHub();
  };

  const handleSubmitAppeal = async (sanction: GovernanceSanctionRow) => {
    if (!profile?.id) return;
    if (openAppealsBySanctionId[sanction.id]) {
      toast.error(t('governanceHub.appealAlreadyOpen'));
      return;
    }

    const draft = appealDraftBySanctionId[sanction.id] || { reason: '', evidence: '' };
    if (!draft.reason.trim()) {
      toast.error(t('governanceHub.appealReasonRequired'));
      return;
    }

    setSubmittingAppealForSanctionId(sanction.id);

    const { error } = await supabase
      .from('governance_sanction_appeals')
      .insert({
        sanction_id: sanction.id,
        profile_id: profile.id,
        appeal_reason: draft.reason.trim(),
        evidence_notes: draft.evidence.trim() || null,
      });

    if (error) {
      console.error('Failed to submit governance sanction appeal:', error);
      toast.error(t('governanceHub.appealSubmitFailed'));
      setSubmittingAppealForSanctionId(null);
      return;
    }

    setAppealDraftBySanctionId((current) => ({
      ...current,
      [sanction.id]: { reason: '', evidence: '' },
    }));
    toast.success(t('governanceHub.appealSubmitted'));
    setSubmittingAppealForSanctionId(null);
    await loadSanctionsAndAppeals();
  };

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{t('governanceHub.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('governanceHub.subtitle')}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="grid gap-3 md:grid-cols-4"
        >
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.cards.score')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {loadingEligibility ? '—' : governanceScore?.toFixed(1) ?? '—'}
            </p>
          </Card>
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.cards.eligibility')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {governanceEligibility.eligible ? t('governanceHub.eligible') : t('governanceHub.ineligible')}
            </p>
          </Card>
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.cards.eligibleCitizens')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{eligibleCitizenCount}</p>
          </Card>
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.cards.mode')}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {eligibleCitizenCount <= 1 ? t('governanceHub.bootstrapMode') : t('governanceHub.collectiveMode')}
            </p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={governanceEligibility.eligible ? 'secondary' : 'outline'}>
                {governanceEligibility.eligible ? t('governanceHub.eligible') : t('governanceHub.ineligible')}
              </Badge>
              <Badge variant={profile?.is_active_citizen ? 'secondary' : 'outline'}>
                {profile?.is_active_citizen ? t('admin.users.activeCitizenBadge') : t('governanceHub.notActiveCitizen')}
              </Badge>
            </div>

            {!governanceEligibility.eligible && (
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>{t('governanceHub.requirementsTitle')}</p>
                {requirementMessages.map((message) => (
                  <p key={message}>• {message}</p>
                ))}
                {proposalBlockedBySanction && <p>• {t('governanceHub.proposeBlockedBySanction')}</p>}
                {voteBlockedBySanction && <p>• {t('governanceHub.voteBlockedBySanction')}</p>}
                {eligibilityUnavailable && <p>• {t('governanceHub.scoreUnavailable')}</p>}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.sanctionsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('governanceHub.sanctionsDescription')}</p>
            </div>

            {sanctionsBackendUnavailable ? (
              <p className="mt-4 text-sm text-muted-foreground">{t('governanceHub.backendUnavailable')}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {activeSanctions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('governanceHub.activeSanctionsEmpty')}</p>
                ) : (
                  activeSanctions.map((sanction) => {
                    const scope = getGovernanceSanctionScopeOptionFromRow(sanction);
                    const openAppeal = openAppealsBySanctionId[sanction.id] || null;
                    const draft = appealDraftBySanctionId[sanction.id] || { reason: '', evidence: '' };
                    const canSubmitAppeal = !openAppeal;

                    return (
                      <div key={sanction.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full">
                            {t(getGovernanceSanctionScopeLabelKey(scope))}
                          </Badge>
                          {openAppeal && (
                            <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                              {t(getGovernanceSanctionAppealStatusLabelKey(openAppeal.status))}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{t('governanceHub.sanctionReasonLabel')}:</span> {sanction.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('governanceHub.sanctionStartsAtLabel')}: {formatDateTime(sanction.starts_at)}
                          {' • '}
                          {t('governanceHub.sanctionEndsAtLabel')}: {sanction.ends_at ? formatDateTime(sanction.ends_at) : '—'}
                        </p>

                        {openAppeal ? (
                          <p className="text-sm text-muted-foreground">{t('governanceHub.appealAlreadyOpen')}</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">{t('governanceHub.appealsTitle')}</p>
                            <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.appealReasonLabel')}</label>
                            <Textarea
                              value={draft.reason}
                              placeholder={t('governanceHub.appealReasonPlaceholder')}
                              onChange={(event) => {
                                const value = event.target.value;
                                setAppealDraftBySanctionId((current) => ({
                                  ...current,
                                  [sanction.id]: {
                                    ...draft,
                                    reason: value,
                                  },
                                }));
                              }}
                            />
                            <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.appealEvidenceLabel')}</label>
                            <Textarea
                              value={draft.evidence}
                              placeholder={t('governanceHub.appealEvidencePlaceholder')}
                              onChange={(event) => {
                                const value = event.target.value;
                                setAppealDraftBySanctionId((current) => ({
                                  ...current,
                                  [sanction.id]: {
                                    ...draft,
                                    evidence: value,
                                  },
                                }));
                              }}
                            />
                            <Button
                              className="w-full md:w-auto"
                              disabled={!canSubmitAppeal || submittingAppealForSanctionId === sanction.id}
                              onClick={() => void handleSubmitAppeal(sanction)}
                            >
                              {submittingAppealForSanctionId === sanction.id ? t('common.saving') : t('governanceHub.appealSubmit')}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{t('governanceHub.appealsTitle')}</h3>
                  {appeals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('governanceHub.appealsEmpty')}</p>
                  ) : (
                    <div className="space-y-2">
                      {appeals.map((appeal) => (
                        <div key={appeal.id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full text-[11px]">
                              {t(getGovernanceSanctionAppealStatusLabelKey(appeal.status))}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-foreground">{appeal.appeal_reason}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(appeal.opened_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Suspense
            fallback={(
              <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('common.loading')}</span>
                </div>
              </Card>
            )}
          >
            <GovernanceProposalComposer
              draft={proposalDraft}
              executionUnits={executionUnits}
              profileDirectory={profileDirectory}
              monetaryPolicyProfiles={monetaryPolicyProfiles}
              contentItems={contentItems}
              studyCertificationOptions={studyCertificationOptions}
              creatingProposal={creatingProposal}
              governanceEligible={governanceEligibility.eligible && !proposalBlockedBySanction}
              backendUnavailable={backendUnavailable}
              formatContentItemLabel={formatContentItemLabel}
              formatProfileLabel={formatProfileLabel}
              onCreate={() => void handleCreateProposal()}
              onDraftChange={setProposalDraft}
              t={t}
            />
          </Suspense>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.unitsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('governanceHub.unitsDescription')}</p>
            </div>

            {loadingHub ? (
              <Card className="flex items-center justify-center gap-2 rounded-3xl border-border/60 px-6 py-12 text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </Card>
            ) : executionUnits.length === 0 ? (
              <Card className="rounded-3xl border-border/60 p-5 text-sm text-muted-foreground shadow-sm">
                {t('governanceHub.unitsEmpty')}
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {executionUnits.map((unit) => {
                  const memberships = membershipsByUnit[unit.id] || [];

                  return (
                    <Card key={unit.id} className="rounded-3xl border-border/60 p-4 shadow-sm">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-foreground">{unit.name}</h3>
                          <Badge variant="outline">{memberships.length} {t('governanceHub.unitSeats')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{unit.description}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{unit.domain_key}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.proposalsTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('governanceHub.proposalsDescription')}</p>
              </div>
            </div>

            {verifierFederationExecutionGate?.policyRequiresFederationDistribution
              && (
                !verifierFederationExecutionGate.distributionGateMet
                || (
                  verifierFederationExecutionGate.federationOps !== null
                  && !verifierFederationExecutionGate.federationOps.federationOpsReady
                )
              ) && (
              <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4 text-sm shadow-sm">
                <p className="font-medium text-foreground">{t('governanceHub.federationExecutionGateBannerTitle')}</p>
                {!verifierFederationExecutionGate.distributionGateMet && (
                  <p className="mt-2 text-muted-foreground">{t('governanceHub.federationDistributionGateBannerBody')}</p>
                )}
                {verifierFederationExecutionGate.federationOps !== null
                  && !verifierFederationExecutionGate.federationOps.federationOpsReady && (
                  <div className="mt-2 space-y-2 text-muted-foreground">
                    <p>{t('governanceHub.federationOpsGateIntro')}</p>
                    {verifierFederationExecutionGate.federationOps.onboardedOperatorCount
                      < verifierFederationExecutionGate.federationOps.minOnboardedFederationOperators && (
                      <p>
                        {t('governanceHub.federationOpsGateOperators', {
                          have: verifierFederationExecutionGate.federationOps.onboardedOperatorCount,
                          need: verifierFederationExecutionGate.federationOps.minOnboardedFederationOperators,
                        })}
                      </p>
                    )}
                    {verifierFederationExecutionGate.federationOps.openCriticalAlertCount
                      > verifierFederationExecutionGate.federationOps.maxOpenCriticalFederationAlerts && (
                      <p>
                        {t('governanceHub.federationOpsGateCriticalAlerts', {
                          open: verifierFederationExecutionGate.federationOps.openCriticalAlertCount,
                          max: verifierFederationExecutionGate.federationOps.maxOpenCriticalFederationAlerts,
                        })}
                      </p>
                    )}
                    {verifierFederationExecutionGate.federationOps.alertSlaBreachedCount > 0 && (
                      <p>{t('governanceHub.federationOpsGateSlaBreaches')}</p>
                    )}
                    {verifierFederationExecutionGate.federationOps.distributionVerificationStale && (
                      <p>{t('governanceHub.federationOpsGateStaleVerification')}</p>
                    )}
                    {verifierFederationExecutionGate.federationOps.openDistributionVerificationAlertCount > 0 && (
                      <p>
                        {t('governanceHub.federationOpsGateDistributionAlerts', {
                          count: verifierFederationExecutionGate.federationOps.openDistributionVerificationAlertCount,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )}

            {loadingHub ? (
              <Card className="flex items-center justify-center gap-2 rounded-3xl border-border/60 px-6 py-16 text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </Card>
            ) : backendUnavailable ? (
              <Card className="rounded-3xl border-border/60 p-5 text-sm text-muted-foreground shadow-sm">
                {t('governanceHub.backendUnavailable')}
              </Card>
            ) : proposals.length === 0 ? (
              <Card className="rounded-3xl border-border/60 p-5 text-sm text-muted-foreground shadow-sm">
                {t('governanceHub.empty')}
              </Card>
            ) : (
              proposals.map((proposal) => {
                const proposalVotes = votesByProposal[proposal.id] || [];
                const currentVote = currentUserVotes[proposal.id];
                const recentEvent = events.find((event) => event.proposal_id === proposal.id);
                const proposalImplementations = implementationsByProposal[proposal.id] || [];
                const executionSpec = readGovernanceProposalExecutionSpec(proposal.metadata);
                const requiresGuardianSignoff = (
                  readGovernanceExecutionThresholdRuleFromMetadata(proposal.metadata)
                  || resolveGovernanceExecutionThresholdRule({
                    actionType: executionSpec.actionType,
                    decisionClass: proposal.decision_class,
                  })
                ).approvalClass === 'guardian_threshold';

                return (
                  <Card key={proposal.id} className="rounded-3xl border-border/60 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{t(getGovernanceProposalStatusLabelKey(proposal.status))}</Badge>
                          <Badge variant="outline">{t(getGovernanceDecisionClassLabelKey(proposal.decision_class))}</Badge>
                          <Badge variant="outline">{t(getGovernanceExecutionActionLabelKey(executionSpec.actionType))}</Badge>
                          {proposal.bootstrap_mode && <Badge variant="outline">{t('governanceHub.bootstrapMode')}</Badge>}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">{proposal.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{proposal.summary}</p>
                        </div>
                        <p className="text-sm leading-6 text-foreground/90">{proposal.body}</p>
                        <p className="text-sm text-muted-foreground">{describeGovernanceProposalExecution(executionSpec)}</p>
                      </div>

                      <div className="min-w-[240px] space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.opensAt')}</p>
                            <p className="mt-1 text-foreground">{formatDateTime(proposal.opens_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.closesAt')}</p>
                            <p className="mt-1 text-foreground">{formatDateTime(proposal.closes_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.quorum')}</p>
                            <p className="mt-1 text-foreground">{proposal.required_quorum}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.eligibleSnapshot')}</p>
                            <p className="mt-1 text-foreground">{proposal.eligible_voter_count_snapshot}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
                            <p className="text-xs uppercase tracking-[0.14em]">{t('governanceHub.voteChoices.approve')}</p>
                            <p className="mt-1 font-semibold">{proposalVotes.filter((vote) => vote.choice === 'approve').length}</p>
                          </div>
                          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-700 dark:text-rose-300">
                            <p className="text-xs uppercase tracking-[0.14em]">{t('governanceHub.voteChoices.reject')}</p>
                            <p className="mt-1 font-semibold">{proposalVotes.filter((vote) => vote.choice === 'reject').length}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-muted/60 px-3 py-2 text-muted-foreground">
                            <p className="text-xs uppercase tracking-[0.14em]">{t('governanceHub.voteChoices.abstain')}</p>
                            <p className="mt-1 font-semibold">{proposalVotes.filter((vote) => vote.choice === 'abstain').length}</p>
                          </div>
                        </div>

                        {currentVote && (
                          <p className="text-sm text-muted-foreground">
                            {t('governanceHub.yourVote', { choice: t(getGovernanceVoteChoiceLabelKey(currentVote.choice)) })}
                          </p>
                        )}

                        {recentEvent && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>{formatDateTime(recentEvent.created_at)}</span>
                          </div>
                        )}

                        {proposal.status === 'open' && (
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              variant="secondary"
                              className="gap-2"
                              disabled={!governanceEligibility.eligible || voteBlockedBySanction || votingProposalId === proposal.id}
                              onClick={() => void handleVote(proposal, 'approve')}
                            >
                              {votingProposalId === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              {t('governanceHub.actions.approve')}
                            </Button>
                            <Button
                              variant="outline"
                              className="gap-2"
                              disabled={!governanceEligibility.eligible || voteBlockedBySanction || votingProposalId === proposal.id}
                              onClick={() => void handleVote(proposal, 'reject')}
                            >
                              <XCircle className="h-4 w-4" />
                              {t('governanceHub.actions.reject')}
                            </Button>
                            <Button
                              variant="ghost"
                              className="gap-2"
                              disabled={!governanceEligibility.eligible || voteBlockedBySanction || votingProposalId === proposal.id}
                              onClick={() => void handleVote(proposal, 'abstain')}
                            >
                              <Vote className="h-4 w-4" />
                              {t('governanceHub.actions.abstain')}
                            </Button>
                            <GovernanceGuardianSignoffCard
                              proposalId={proposal.id}
                              proposalStatus={proposal.status}
                              requiresGuardianSignoff={requiresGuardianSignoff}
                              isGuardianSigner={isGuardianSigner}
                              isBlocked={voteBlockedBySanction}
                              profileId={profile?.id ?? null}
                              onUpdated={loadGovernanceHub}
                            />
                          </div>
                        )}

                        {proposal.final_decision_summary && (
                          <p className="text-sm text-muted-foreground">{proposal.final_decision_summary}</p>
                        )}

                        {proposalImplementations.length > 0 && (
                          <div className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-3">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              {t('governanceHub.implementationQueueTitle')}
                            </p>
                            {proposalImplementations.map((implementation) => {
                              const unit = unitsById[implementation.unit_id];
                              const canExecuteImplementation = currentUserUnitIds.has(implementation.unit_id)
                                && executionSpec.autoExecutable
                                && !executionBlockedBySanction
                                && (implementation.status === 'queued' || implementation.status === 'blocked');
                              const targetProfile = 'profileId' in executionSpec
                                ? profileDirectoryById[executionSpec.profileId]
                                : null;
                              const targetPolicy = 'policyProfileId' in executionSpec
                                ? monetaryPolicyProfiles.find((policy) => policy.id === executionSpec.policyProfileId) || null
                                : null;
                              const targetContentItem = 'contentItemId' in executionSpec
                                ? contentItemsById[executionSpec.contentItemId] || null
                                : null;
                              const targetCertification = 'certificationKey' in executionSpec
                                ? studyCertificationLabelByKey[executionSpec.certificationKey] || executionSpec.certificationKey
                                : null;
                              return (
                                <div key={implementation.id} className="rounded-2xl border border-border/60 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {unit?.name || t(getGovernanceUnitLabelKey((implementation.metadata as { unit_key?: string } | null)?.unit_key || 'civic_operations'))}
                                    </p>
                                    <Badge
                                      className={getGovernanceImplementationStatusClassName(implementation.status)}
                                      variant="outline"
                                    >
                                      {t(getGovernanceImplementationStatusLabelKey(implementation.status))}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm text-muted-foreground">{implementation.implementation_summary}</p>
                                  {'targetUnitKey' in executionSpec && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {t('governanceHub.targetUnitLabel')}: {t(getGovernanceUnitLabelKey(executionSpec.targetUnitKey))}
                                    </p>
                                  )}
                                  {targetProfile && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {t('governanceHub.targetProfileLabel')}: {formatProfileLabel(targetProfile)}
                                    </p>
                                  )}
                                  {targetPolicy && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {t('governanceHub.targetPolicyLabel')}: {targetPolicy.policy_name} ({targetPolicy.version})
                                    </p>
                                  )}
                                  {targetCertification && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {t('governanceHub.targetCertificationLabel')}: {targetCertification}
                                    </p>
                                  )}
                                  {targetContentItem && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {t('governanceHub.targetContentItemLabel')}: {formatContentItemLabel(targetContentItem)}
                                    </p>
                                  )}
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {t('governanceHub.assignedAt')}: {formatDateTime(implementation.assigned_at)}
                                  </p>
                                  {canExecuteImplementation && (
                                    <div className="mt-3 flex justify-end">
                                      <Button
                                        size="sm"
                                        className="gap-2"
                                        disabled={executingImplementationId === implementation.id}
                                        onClick={() => void handleExecuteImplementation(proposal, implementation)}
                                      >
                                        {executingImplementationId === implementation.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <ArrowRight className="h-4 w-4" />
                                        )}
                                        {t('governanceHub.executeAction')}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
