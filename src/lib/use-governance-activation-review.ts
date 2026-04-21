import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  isMissingActivationReviewBackend,
  toActivationScopeKey,
  type ActivationDecisionRow,
  type ActivationDemographicSnapshotRow,
  type ActivationEvidenceRow,
  type ActivationReviewDecision,
  type ActivationScopeType,
  type ActivationThresholdReviewRow,
} from '@/lib/governance-activation-review';

function buildLatestByReviewId<T extends { review_id: string }>(rows: T[]) {
  return rows.reduce<Record<string, T>>((accumulator, row) => {
    if (!accumulator[row.review_id]) {
      accumulator[row.review_id] = row;
    }
    return accumulator;
  }, {});
}

export interface ActivationDemographicSnapshotDraft {
  scopeType: ActivationScopeType;
  countryCode: string;
  jurisdictionLabel: string;
  targetPopulation: number;
  sourceLabel: string;
  sourceUrl: string;
  observedAt: string;
  notes: string;
}

export function useGovernanceActivationReview(args: { profileId: string | null | undefined }) {
  const [loadingActivationReview, setLoadingActivationReview] = useState(true);
  const [activationReviewBackendUnavailable, setActivationReviewBackendUnavailable] = useState(false);
  const [refreshingAllActivationDemographics, setRefreshingAllActivationDemographics] = useState(false);
  const [refreshingActivationScopeKey, setRefreshingActivationScopeKey] = useState<string | null>(null);
  const [savingActivationDemographicSnapshot, setSavingActivationDemographicSnapshot] = useState(false);
  const [recordingActivationDecisionReviewId, setRecordingActivationDecisionReviewId] = useState<string | null>(null);

  const [activationReviews, setActivationReviews] = useState<ActivationThresholdReviewRow[]>([]);
  const [activationDemographicSnapshots, setActivationDemographicSnapshots] = useState<ActivationDemographicSnapshotRow[]>([]);
  const [latestActivationEvidenceByReviewId, setLatestActivationEvidenceByReviewId] = useState<Record<string, ActivationEvidenceRow>>({});
  const [latestActivationDecisionByReviewId, setLatestActivationDecisionByReviewId] = useState<Record<string, ActivationDecisionRow>>({});

  const loadActivationReviewData = useCallback(async () => {
    setLoadingActivationReview(true);

    const [reviewResponse, evidenceResponse, decisionsResponse, demographicResponse] = await Promise.all([
      supabase
        .from('activation_threshold_reviews')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(120),
      supabase
        .from('activation_evidence')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('activation_decisions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('activation_demographic_snapshots')
        .select('*')
        .order('observed_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const sharedError = reviewResponse.error || evidenceResponse.error || decisionsResponse.error || demographicResponse.error;
    if (isMissingActivationReviewBackend(sharedError)) {
      setActivationReviewBackendUnavailable(true);
      setLoadingActivationReview(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load activation review stewardship data:', {
        reviewError: reviewResponse.error,
        evidenceError: evidenceResponse.error,
        decisionsError: decisionsResponse.error,
        demographicError: demographicResponse.error,
      });
      toast.error('Could not load activation review data.');
      setLoadingActivationReview(false);
      return;
    }

    const reviews = (reviewResponse.data as ActivationThresholdReviewRow[]) || [];
    const evidenceRows = (evidenceResponse.data as ActivationEvidenceRow[]) || [];
    const decisionRows = (decisionsResponse.data as ActivationDecisionRow[]) || [];
    const demographicRows = (demographicResponse.data as ActivationDemographicSnapshotRow[]) || [];

    setActivationReviews(reviews);
    setActivationDemographicSnapshots(demographicRows);
    setLatestActivationEvidenceByReviewId(buildLatestByReviewId(evidenceRows));
    setLatestActivationDecisionByReviewId(buildLatestByReviewId(decisionRows));
    setActivationReviewBackendUnavailable(false);
    setLoadingActivationReview(false);
  }, []);

  useEffect(() => {
    void loadActivationReviewData();
  }, [loadActivationReviewData]);

  const handleRefreshAllActivationDemographics = useCallback(async () => {
    if (activationReviewBackendUnavailable) return;

    setRefreshingAllActivationDemographics(true);

    const { data: refreshedCount, error } = await supabase.rpc('capture_scheduled_activation_demographic_snapshots', {
      snapshot_source: 'steward_manual_refresh',
      snapshot_notes: 'Manual demographic refresh from governance admin activation panel',
    });

    if (error) {
      console.error('Failed to refresh activation demographic snapshots:', error);
      toast.error('Could not refresh activation demographic snapshots.');
      setRefreshingAllActivationDemographics(false);
      return;
    }

    const count = typeof refreshedCount === 'number' ? refreshedCount : 0;
    toast.success(count > 0 ? `Refreshed demographic snapshots for ${count} activation scope${count === 1 ? '' : 's'}.` : 'No activation scopes were available to refresh.');
    setRefreshingAllActivationDemographics(false);
    await loadActivationReviewData();
  }, [activationReviewBackendUnavailable, loadActivationReviewData]);

  const handleRefreshActivationScopeDemographics = useCallback(async (scopeType: ActivationScopeType, countryCode: string) => {
    if (activationReviewBackendUnavailable) return;

    const scopeKey = toActivationScopeKey(scopeType, countryCode);
    setRefreshingActivationScopeKey(scopeKey);

    const { error } = await supabase.rpc('capture_activation_demographic_snapshot', {
      requested_scope_type: scopeType,
      requested_country_code: scopeType === 'world' ? '' : countryCode,
      snapshot_source: 'steward_scope_refresh',
      snapshot_notes: 'Manual scope refresh from governance admin activation panel',
      measured_by_profile_id: args.profileId ?? undefined,
    });

    if (error) {
      console.error('Failed to refresh activation scope demographic snapshot:', {
        scopeType,
        countryCode,
        error,
      });
      toast.error('Could not refresh demographics for this activation scope.');
      setRefreshingActivationScopeKey(null);
      return;
    }

    toast.success('Activation scope demographics refreshed.');
    setRefreshingActivationScopeKey(null);
    await loadActivationReviewData();
  }, [activationReviewBackendUnavailable, args.profileId, loadActivationReviewData]);

  const handleSaveActivationDemographicSnapshot = useCallback(async (draft: ActivationDemographicSnapshotDraft) => {
    if (!args.profileId || activationReviewBackendUnavailable) return;

    setSavingActivationDemographicSnapshot(true);

    const countryCode = draft.scopeType === 'world' ? '' : draft.countryCode.toUpperCase();
    const parsedObservedAt = draft.observedAt ? new Date(draft.observedAt) : new Date();
    const observedAt = Number.isNaN(parsedObservedAt.getTime()) ? new Date().toISOString() : parsedObservedAt.toISOString();

    const insertPayload = {
      scope_type: draft.scopeType,
      country_code: countryCode,
      jurisdiction_label: draft.jurisdictionLabel || (draft.scopeType === 'world' ? 'World' : countryCode),
      target_population: draft.targetPopulation,
      source_label: draft.sourceLabel,
      source_url: draft.sourceUrl || null,
      observed_at: observedAt,
      ingestion_notes: draft.notes || null,
      created_by: args.profileId,
      metadata: {
        source: 'governance_admin_activation_card',
      },
    };

    const { error: snapshotError } = await supabase
      .from('activation_demographic_snapshots')
      .insert(insertPayload);

    if (snapshotError) {
      console.error('Failed to save activation demographic snapshot:', snapshotError);
      toast.error('Could not save demographic snapshot.');
      setSavingActivationDemographicSnapshot(false);
      return;
    }

    const { error: refreshError } = await supabase.rpc('capture_activation_demographic_snapshot', {
      requested_scope_type: draft.scopeType,
      requested_country_code: countryCode,
      snapshot_source: 'demographic_snapshot_insert',
      snapshot_notes: 'Applied after steward demographic snapshot insert',
      measured_by_profile_id: args.profileId,
    });

    if (refreshError) {
      console.error('Failed to apply activation demographic snapshot after save:', refreshError);
      toast.error('Demographic snapshot saved, but review metrics could not be refreshed.');
      setSavingActivationDemographicSnapshot(false);
      await loadActivationReviewData();
      return;
    }

    toast.success('Demographic snapshot ingested and activation metrics refreshed.');
    setSavingActivationDemographicSnapshot(false);
    await loadActivationReviewData();
  }, [activationReviewBackendUnavailable, args.profileId, loadActivationReviewData]);

  const handleRecordActivationDecision = useCallback(async (argsForDecision: {
    reviewId: string;
    decision: ActivationReviewDecision;
    notes: string;
  }) => {
    if (!args.profileId || activationReviewBackendUnavailable) return;

    setRecordingActivationDecisionReviewId(argsForDecision.reviewId);

    const { error } = await supabase
      .from('activation_decisions')
      .insert({
        review_id: argsForDecision.reviewId,
        reviewer_id: args.profileId,
        decision: argsForDecision.decision,
        notes: argsForDecision.notes || null,
        metadata: {
          source: 'governance_admin_activation_card',
        },
      });

    if (error) {
      console.error('Failed to record activation review decision:', error);
      toast.error('Could not record the activation decision.');
      setRecordingActivationDecisionReviewId(null);
      return;
    }

    toast.success('Activation decision recorded.');
    setRecordingActivationDecisionReviewId(null);
    await loadActivationReviewData();
  }, [activationReviewBackendUnavailable, args.profileId, loadActivationReviewData]);

  return {
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
  };
}
