import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditVerifierMirrorDirectorySummaryRows,
  readGovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  readGovernancePublicAuditVerifierMirrorProbeJobBoardRows,
  readGovernancePublicAuditVerifierMirrorProbeJobSummary,
  type GovernancePublicAuditVerifierMirrorDirectorySummaryRow,
  type GovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  type GovernancePublicAuditVerifierMirrorProbeJobBoardRow,
  type GovernancePublicAuditVerifierMirrorProbeJobSummary,
} from '@/lib/governance-public-audit-verifiers';

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

type RpcResponseLike<T> = {
  data: T | null;
  error: RpcErrorLike;
};

function callUntypedRpc<T>(fnName: string, params?: Record<string, unknown>) {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResponseLike<T>>;

  return rpc(fnName, params);
}

export function useGovernancePublicAuditVerifierMirrorProduction(args: { latestBatchId: string | null }) {
  const [loadingProductionData, setLoadingProductionData] = useState(true);
  const [productionBackendUnavailable, setProductionBackendUnavailable] = useState(false);
  const [canManageMirrorProduction, setCanManageMirrorProduction] = useState(false);

  const [savingFailoverPolicy, setSavingFailoverPolicy] = useState(false);
  const [registeringDirectorySigner, setRegisteringDirectorySigner] = useState(false);
  const [publishingSignedDirectory, setPublishingSignedDirectory] = useState(false);
  const [schedulingProbeJobs, setSchedulingProbeJobs] = useState(false);
  const [completingProbeJob, setCompletingProbeJob] = useState(false);

  const [failoverPolicy, setFailoverPolicy] = useState<GovernancePublicAuditVerifierMirrorFailoverPolicySummary | null>(null);
  const [directorySummaries, setDirectorySummaries] = useState<GovernancePublicAuditVerifierMirrorDirectorySummaryRow[]>([]);
  const [probeJobSummary, setProbeJobSummary] = useState<GovernancePublicAuditVerifierMirrorProbeJobSummary | null>(null);
  const [probeJobs, setProbeJobs] = useState<GovernancePublicAuditVerifierMirrorProbeJobBoardRow[]>([]);

  const loadProductionData = useCallback(async () => {
    setLoadingProductionData(true);

    const [
      permissionResponse,
      failoverPolicyResponse,
      directorySummaryResponse,
      probeSummaryResponse,
      probeBoardResponse,
    ] = await Promise.all([
      supabase.rpc('current_profile_can_manage_public_audit_verifiers'),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_failover_policy_summary', {
        requested_policy_key: 'default',
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_directory_summary', {
        requested_batch_id: args.latestBatchId,
        max_entries: 12,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_probe_job_summary', {
        requested_batch_id: args.latestBatchId,
        requested_pending_sla_minutes: 30,
        requested_lookback_hours: 24,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_probe_job_board', {
        requested_batch_id: args.latestBatchId,
        max_jobs: 80,
      }),
    ]);

    const sharedError = permissionResponse.error
      || failoverPolicyResponse.error
      || directorySummaryResponse.error
      || probeSummaryResponse.error
      || probeBoardResponse.error;

    if (isMissingPublicAuditVerifierBackend(sharedError)) {
      setProductionBackendUnavailable(true);
      setLoadingProductionData(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load verifier mirror production data:', {
        permissionError: permissionResponse.error,
        failoverPolicyError: failoverPolicyResponse.error,
        directorySummaryError: directorySummaryResponse.error,
        probeSummaryError: probeSummaryResponse.error,
        probeBoardError: probeBoardResponse.error,
      });
      toast.error('Could not load mirror production rollout data.');
      setLoadingProductionData(false);
      return;
    }

    setCanManageMirrorProduction(Boolean(permissionResponse.data));
    setFailoverPolicy(readGovernancePublicAuditVerifierMirrorFailoverPolicySummary(failoverPolicyResponse.data));
    setDirectorySummaries(readGovernancePublicAuditVerifierMirrorDirectorySummaryRows(directorySummaryResponse.data));
    setProbeJobSummary(readGovernancePublicAuditVerifierMirrorProbeJobSummary(probeSummaryResponse.data));
    setProbeJobs(readGovernancePublicAuditVerifierMirrorProbeJobBoardRows(probeBoardResponse.data));
    setProductionBackendUnavailable(false);
    setLoadingProductionData(false);
  }, [args.latestBatchId]);

  useEffect(() => {
    void loadProductionData();
  }, [loadProductionData]);

  const saveFailoverPolicy = useCallback(async (draft: {
    minHealthyMirrors: string;
    maxMirrorLatencyMs: string;
    maxFailuresBeforeCooldown: string;
    cooldownMinutes: string;
    preferSameRegion: boolean;
    requiredDistinctRegions: string;
    requiredDistinctOperators: string;
    mirrorSelectionStrategy: string;
    maxMirrorCandidates: string;
  }) => {
    if (productionBackendUnavailable || !canManageMirrorProduction) return;

    setSavingFailoverPolicy(true);

    const toIntegerOrNull = (value: string) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const { error } = await callUntypedRpc<string>('upsert_governance_public_audit_verifier_mirror_failover_policy', {
      policy_key: 'default',
      policy_name: 'Default mirror failover policy',
      is_active: true,
      min_healthy_mirrors: toIntegerOrNull(draft.minHealthyMirrors),
      max_mirror_latency_ms: toIntegerOrNull(draft.maxMirrorLatencyMs),
      max_failures_before_cooldown: toIntegerOrNull(draft.maxFailuresBeforeCooldown),
      cooldown_minutes: toIntegerOrNull(draft.cooldownMinutes),
      prefer_same_region: draft.preferSameRegion,
      required_distinct_regions: toIntegerOrNull(draft.requiredDistinctRegions),
      required_distinct_operators: toIntegerOrNull(draft.requiredDistinctOperators),
      mirror_selection_strategy: draft.mirrorSelectionStrategy.trim() || 'health_latency_diversity',
      max_mirror_candidates: toIntegerOrNull(draft.maxMirrorCandidates),
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to save mirror failover policy:', error);
      toast.error('Could not save mirror failover policy.');
      setSavingFailoverPolicy(false);
      return;
    }

    toast.success('Mirror failover policy saved.');
    setSavingFailoverPolicy(false);
    await loadProductionData();
  }, [canManageMirrorProduction, loadProductionData, productionBackendUnavailable]);

  const registerDirectorySigner = useCallback(async (draft: {
    signerKey: string;
    signerLabel: string;
    publicKey: string;
    signingAlgorithm: string;
    trustTier: string;
  }) => {
    if (productionBackendUnavailable || !canManageMirrorProduction) return;

    if (!draft.signerKey.trim() || !draft.publicKey.trim()) {
      toast.error('Signer key and public key are required.');
      return;
    }

    setRegisteringDirectorySigner(true);

    const { error } = await callUntypedRpc<string>('register_governance_public_audit_verifier_mirror_directory_signer', {
      signer_key: draft.signerKey.trim(),
      signer_label: draft.signerLabel.trim() || null,
      public_key: draft.publicKey.trim(),
      signing_algorithm: draft.signingAlgorithm.trim() || 'ed25519',
      trust_tier: draft.trustTier.trim() || 'observer',
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to register mirror directory signer:', error);
      toast.error('Could not save mirror directory signer.');
      setRegisteringDirectorySigner(false);
      return;
    }

    toast.success('Mirror directory signer saved.');
    setRegisteringDirectorySigner(false);
    await loadProductionData();
  }, [canManageMirrorProduction, loadProductionData, productionBackendUnavailable]);

  const publishSignedDirectory = useCallback(async (draft: {
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
  }) => {
    if (productionBackendUnavailable || !canManageMirrorProduction) return;

    if (!draft.signerKey.trim() || !draft.signature.trim()) {
      toast.error('Signer key and signature are required.');
      return;
    }

    setPublishingSignedDirectory(true);

    const { error } = await callUntypedRpc<string>('publish_governance_public_audit_verifier_mirror_directory', {
      signer_key: draft.signerKey.trim(),
      signature: draft.signature.trim(),
      target_batch_id: args.latestBatchId,
      signature_algorithm: draft.signatureAlgorithm.trim() || 'ed25519',
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to publish signed mirror directory:', error);
      toast.error('Could not publish signed mirror directory.');
      setPublishingSignedDirectory(false);
      return;
    }

    toast.success('Signed mirror directory published.');
    setPublishingSignedDirectory(false);
    await loadProductionData();
  }, [args.latestBatchId, canManageMirrorProduction, loadProductionData, productionBackendUnavailable]);

  const scheduleProbeJobs = useCallback(async (forceReschedule: boolean) => {
    if (productionBackendUnavailable || !canManageMirrorProduction) return;

    setSchedulingProbeJobs(true);

    const { data, error } = await callUntypedRpc<number>('schedule_governance_public_audit_verifier_mirror_probe_jobs', {
      target_batch_id: args.latestBatchId,
      force_reschedule: forceReschedule,
      requested_timeout_ms: failoverPolicy?.maxMirrorLatencyMs
        ? Math.max(500, failoverPolicy.maxMirrorLatencyMs * 2)
        : 8000,
    });

    if (error) {
      console.error('Failed to schedule verifier mirror probe jobs:', error);
      toast.error('Could not schedule mirror probe jobs.');
      setSchedulingProbeJobs(false);
      return;
    }

    const count = typeof data === 'number' && Number.isFinite(data) ? Math.max(0, Math.floor(data)) : 0;
    toast.success(
      count > 0
        ? `Scheduled ${count} mirror probe job${count === 1 ? '' : 's'}.`
        : 'No additional mirror probe jobs needed.',
    );

    setSchedulingProbeJobs(false);
    await loadProductionData();
  }, [args.latestBatchId, canManageMirrorProduction, failoverPolicy?.maxMirrorLatencyMs, loadProductionData, productionBackendUnavailable]);

  const completeProbeJob = useCallback(async (draft: {
    jobId: string;
    completionStatus: 'completed' | 'failed' | 'cancelled';
    checkStatus: 'ok' | 'degraded' | 'failed';
    observedLatencyMs: string;
    observedBatchHash: string;
    errorMessage: string;
  }) => {
    if (productionBackendUnavailable || !canManageMirrorProduction) return;

    if (!draft.jobId) {
      toast.error('Select a probe job first.');
      return;
    }

    setCompletingProbeJob(true);

    const parsedLatency = Number.parseInt(draft.observedLatencyMs, 10);

    const { error } = await callUntypedRpc<string>('complete_governance_public_audit_verifier_mirror_probe_job', {
      target_job_id: draft.jobId,
      completion_status: draft.completionStatus,
      mirror_check_status: draft.completionStatus === 'completed' ? draft.checkStatus : null,
      observed_latency_ms: draft.completionStatus === 'completed' && Number.isFinite(parsedLatency) ? parsedLatency : null,
      observed_batch_hash: draft.observedBatchHash.trim() || null,
      error_message: draft.errorMessage.trim() || null,
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to complete verifier mirror probe job:', error);
      toast.error('Could not save probe job result.');
      setCompletingProbeJob(false);
      return;
    }

    toast.success('Probe job updated.');
    setCompletingProbeJob(false);
    await loadProductionData();
  }, [canManageMirrorProduction, loadProductionData, productionBackendUnavailable]);

  return {
    loadingProductionData,
    productionBackendUnavailable,
    canManageMirrorProduction,
    savingFailoverPolicy,
    registeringDirectorySigner,
    publishingSignedDirectory,
    schedulingProbeJobs,
    completingProbeJob,
    failoverPolicy,
    directorySummaries,
    probeJobSummary,
    probeJobs,
    loadProductionData,
    saveFailoverPolicy,
    registerDirectorySigner,
    publishSignedDirectory,
    scheduleProbeJobs,
    completeProbeJob,
  };
}
