import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  isMissingPublicAuditAutomationBackend,
  readGovernancePublicAuditAnchorExecutionJobBoardRows,
  readGovernancePublicAuditClaimedExecutionJobs,
  readGovernancePublicAuditExternalExecutionCycleResult,
  readGovernancePublicAuditExternalExecutionPageBoardRows,
  readGovernancePublicAuditExternalExecutionPagingSummary,
  readGovernancePublicAuditExternalExecutionPolicySummary,
  readGovernancePublicAuditOperationsSlaSummary,
  type GovernancePublicAuditAnchorAdapterRow,
  type GovernancePublicAuditAnchorExecutionJobBoardRow,
  type GovernancePublicAuditAnchorExecutionJobStatus,
  type GovernancePublicAuditExternalExecutionPageBoardRow,
  type GovernancePublicAuditExternalExecutionPagingSummary,
  type GovernancePublicAuditExternalExecutionPolicySummary,
  type GovernancePublicAuditImmutableAnchorRow,
  type GovernancePublicAuditOperationsSlaSummary,
  type GovernancePublicAuditVerifierJobRow,
} from '@/lib/governance-public-audit-automation';

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

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export function useGovernancePublicAuditAutomation(args: { latestBatchId: string | null }) {
  const [loadingAutomationData, setLoadingAutomationData] = useState(true);
  const [automationBackendUnavailable, setAutomationBackendUnavailable] = useState(false);
  const [canManageAutomation, setCanManageAutomation] = useState(false);

  const [registeringAnchorAdapter, setRegisteringAnchorAdapter] = useState(false);
  const [recordingImmutableAnchor, setRecordingImmutableAnchor] = useState(false);
  const [schedulingAnchorExecutionJobs, setSchedulingAnchorExecutionJobs] = useState(false);
  const [schedulingVerifierJobs, setSchedulingVerifierJobs] = useState(false);
  const [runningExternalExecutionCycle, setRunningExternalExecutionCycle] = useState(false);
  const [completingAnchorExecutionJob, setCompletingAnchorExecutionJob] = useState(false);
  const [completingVerifierJob, setCompletingVerifierJob] = useState(false);
  const [savingExternalExecutionPolicy, setSavingExternalExecutionPolicy] = useState(false);
  const [drainingExternalExecutionQueue, setDrainingExternalExecutionQueue] = useState(false);
  const [evaluatingExternalExecutionPaging, setEvaluatingExternalExecutionPaging] = useState(false);
  const [resolvingExternalExecutionPage, setResolvingExternalExecutionPage] = useState(false);

  const [anchorAdapters, setAnchorAdapters] = useState<GovernancePublicAuditAnchorAdapterRow[]>([]);
  const [immutableAnchors, setImmutableAnchors] = useState<GovernancePublicAuditImmutableAnchorRow[]>([]);
  const [anchorExecutionJobs, setAnchorExecutionJobs] = useState<GovernancePublicAuditAnchorExecutionJobBoardRow[]>([]);
  const [verifierJobs, setVerifierJobs] = useState<GovernancePublicAuditVerifierJobRow[]>([]);
  const [operationsSlaSummary, setOperationsSlaSummary] = useState<GovernancePublicAuditOperationsSlaSummary | null>(null);
  const [externalExecutionPolicy, setExternalExecutionPolicy] = useState<GovernancePublicAuditExternalExecutionPolicySummary | null>(null);
  const [externalExecutionPagingSummary, setExternalExecutionPagingSummary] = useState<GovernancePublicAuditExternalExecutionPagingSummary | null>(null);
  const [externalExecutionPages, setExternalExecutionPages] = useState<GovernancePublicAuditExternalExecutionPageBoardRow[]>([]);

  const loadAutomationData = useCallback(async () => {
    setLoadingAutomationData(true);

    const [
      adapterResponse,
      anchorResponse,
      verifierJobsResponse,
      permissionResponse,
      slaSummaryResponse,
      anchorExecutionBoardResponse,
      policySummaryResponse,
      pagingSummaryResponse,
      pageBoardResponse,
    ] = await Promise.all([
      supabase
        .from('governance_public_audit_anchor_adapters')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
      args.latestBatchId
        ? supabase
            .from('governance_public_audit_immutable_anchors')
            .select('*')
            .eq('batch_id', args.latestBatchId)
            .order('anchored_at', { ascending: false })
            .order('created_at', { ascending: false })
        : supabase
            .from('governance_public_audit_immutable_anchors')
            .select('*')
            .order('anchored_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50),
      args.latestBatchId
        ? supabase
            .from('governance_public_audit_verifier_jobs')
            .select('*')
            .eq('batch_id', args.latestBatchId)
            .order('scheduled_at', { ascending: false })
            .order('created_at', { ascending: false })
        : supabase
            .from('governance_public_audit_verifier_jobs')
            .select('*')
            .order('scheduled_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100),
      supabase.rpc('current_profile_can_manage_public_audit_verifiers'),
      callUntypedRpc<unknown[]>('governance_public_audit_operations_sla_summary', {
        requested_batch_id: args.latestBatchId,
        requested_pending_sla_hours: 4,
        requested_lookback_hours: 24,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_anchor_execution_job_board', {
        requested_batch_id: args.latestBatchId,
        max_jobs: 120,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_external_execution_policy_summary', {
        requested_policy_key: 'default',
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_external_execution_paging_summary', {
        requested_batch_id: args.latestBatchId,
        auto_open_pages: false,
        requested_lookback_hours: 24,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_external_execution_page_board', {
        requested_batch_id: args.latestBatchId,
        max_pages: 80,
      }),
    ]);

    const sharedError = adapterResponse.error
      || anchorResponse.error
      || verifierJobsResponse.error
      || permissionResponse.error
      || slaSummaryResponse.error
      || anchorExecutionBoardResponse.error
      || policySummaryResponse.error
      || pagingSummaryResponse.error
      || pageBoardResponse.error;

    if (isMissingPublicAuditAutomationBackend(sharedError)) {
      setAutomationBackendUnavailable(true);
      setLoadingAutomationData(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load public audit automation data:', {
        adapterError: adapterResponse.error,
        anchorError: anchorResponse.error,
        verifierJobsError: verifierJobsResponse.error,
        permissionError: permissionResponse.error,
        slaSummaryError: slaSummaryResponse.error,
        anchorExecutionBoardError: anchorExecutionBoardResponse.error,
        policySummaryError: policySummaryResponse.error,
        pagingSummaryError: pagingSummaryResponse.error,
        pageBoardError: pageBoardResponse.error,
      });
      toast.error('Could not load immutable anchoring automation data.');
      setLoadingAutomationData(false);
      return;
    }

    setAnchorAdapters((adapterResponse.data as GovernancePublicAuditAnchorAdapterRow[]) || []);
    setImmutableAnchors((anchorResponse.data as GovernancePublicAuditImmutableAnchorRow[]) || []);
    setVerifierJobs((verifierJobsResponse.data as GovernancePublicAuditVerifierJobRow[]) || []);
    setOperationsSlaSummary(readGovernancePublicAuditOperationsSlaSummary(slaSummaryResponse.data));
    setAnchorExecutionJobs(readGovernancePublicAuditAnchorExecutionJobBoardRows(anchorExecutionBoardResponse.data));
    setExternalExecutionPolicy(readGovernancePublicAuditExternalExecutionPolicySummary(policySummaryResponse.data));
    setExternalExecutionPagingSummary(readGovernancePublicAuditExternalExecutionPagingSummary(pagingSummaryResponse.data));
    setExternalExecutionPages(readGovernancePublicAuditExternalExecutionPageBoardRows(pageBoardResponse.data));
    setCanManageAutomation(Boolean(permissionResponse.data));
    setAutomationBackendUnavailable(false);
    setLoadingAutomationData(false);
  }, [args.latestBatchId]);

  useEffect(() => {
    void loadAutomationData();
  }, [loadAutomationData]);

  const registerAnchorAdapter = useCallback(async (draft: {
    adapterKey: string;
    adapterName: string;
    network: string;
    endpointUrl: string;
    attestationScheme: string;
  }) => {
    if (!canManageAutomation || automationBackendUnavailable) return;
    if (!draft.adapterKey.trim() || !draft.adapterName.trim() || !draft.network.trim()) {
      toast.error('Adapter key, name, and network are required.');
      return;
    }

    setRegisteringAnchorAdapter(true);
    const { error } = await supabase.rpc('register_governance_public_audit_anchor_adapter', {
      adapter_key: draft.adapterKey.trim(),
      adapter_name: draft.adapterName.trim(),
      network: draft.network.trim(),
      endpoint_url: draft.endpointUrl.trim() || null,
      attestation_scheme: draft.attestationScheme.trim() || 'append_only_receipt_v1',
      metadata: {
        source: 'governance_public_audit_automation_panel',
      },
    });

    if (error) {
      console.error('Failed to register public audit anchor adapter:', error);
      toast.error('Could not save public audit anchor adapter.');
      setRegisteringAnchorAdapter(false);
      return;
    }

    toast.success('Public audit anchor adapter saved.');
    setRegisteringAnchorAdapter(false);
    await loadAutomationData();
  }, [automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const recordImmutableAnchor = useCallback(async (draft: {
    adapterId: string;
    network: string;
    immutableReference: string;
    blockHeight: string;
  }) => {
    if (!canManageAutomation || automationBackendUnavailable || !args.latestBatchId) return;
    const immutableReference = draft.immutableReference.trim();
    if (!immutableReference) {
      toast.error('Immutable reference is required.');
      return;
    }

    setRecordingImmutableAnchor(true);
    const parsedBlockHeight = Number.parseInt(draft.blockHeight, 10);
    const { error } = await supabase.rpc('record_governance_public_audit_immutable_anchor', {
      target_batch_id: args.latestBatchId,
      target_adapter_id: draft.adapterId || null,
      target_network: draft.network.trim() || null,
      immutable_reference: immutableReference,
      proof_payload: {
        source: 'governance_public_audit_automation_panel',
      },
      proof_block_height: Number.isFinite(parsedBlockHeight) ? parsedBlockHeight : null,
    });

    if (error) {
      console.error('Failed to record immutable public audit anchor:', error);
      toast.error('Could not record immutable anchor.');
      setRecordingImmutableAnchor(false);
      return;
    }

    toast.success('Immutable public audit anchor recorded.');
    setRecordingImmutableAnchor(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const scheduleAnchorExecutionJobs = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setSchedulingAnchorExecutionJobs(true);
    const { data, error } = await callUntypedRpc<number>('schedule_governance_public_audit_anchor_execution_jobs', {
      target_batch_id: args.latestBatchId,
      force_reschedule: forceReschedule,
    });

    if (error) {
      console.error('Failed to schedule public audit anchor execution jobs:', error);
      toast.error('Could not schedule anchor execution jobs.');
      setSchedulingAnchorExecutionJobs(false);
      return;
    }

    const count = typeof data === 'number' && Number.isFinite(data) ? Math.max(0, Math.floor(data)) : 0;
    toast.success(count > 0
      ? `Scheduled ${count} anchor execution job${count === 1 ? '' : 's'}.`
      : 'No additional anchor execution jobs needed.');
    setSchedulingAnchorExecutionJobs(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const scheduleVerifierJobs = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setSchedulingVerifierJobs(true);
    const { data, error } = await callUntypedRpc<number>('schedule_governance_public_audit_verifier_jobs', {
      target_batch_id: args.latestBatchId,
      force_reschedule: forceReschedule,
    });

    if (error) {
      console.error('Failed to schedule public audit verifier jobs:', error);
      toast.error('Could not schedule verifier jobs.');
      setSchedulingVerifierJobs(false);
      return;
    }

    const count = typeof data === 'number' && Number.isFinite(data) ? Math.max(0, Math.floor(data)) : 0;
    toast.success(count > 0 ? `Scheduled ${count} verifier job${count === 1 ? '' : 's'}.` : 'No additional verifier jobs needed.');
    setSchedulingVerifierJobs(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const runExternalExecutionCycle = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setRunningExternalExecutionCycle(true);
    const { data, error } = await callUntypedRpc<unknown[]>('run_governance_public_audit_external_execution_cycle', {
      target_batch_id: args.latestBatchId,
      force_reschedule: forceReschedule,
    });

    if (error) {
      console.error('Failed to run public audit external execution cycle:', error);
      toast.error('Could not run external execution cycle.');
      setRunningExternalExecutionCycle(false);
      return;
    }

    const summary = readGovernancePublicAuditExternalExecutionCycleResult(data);
    if (!summary || !summary.batchId) {
      toast.success('External execution cycle completed with no eligible batches.');
    } else {
      toast.success(
        `External execution cycle scheduled ${summary.anchorJobsScheduled} anchor and ${summary.verifierJobsScheduled} verifier job${summary.verifierJobsScheduled === 1 ? '' : 's'}.`,
      );
    }
    setRunningExternalExecutionCycle(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const saveExternalExecutionPolicy = useCallback(async (draft: {
    claimTtlMinutes: string;
    anchorMaxAttempts: string;
    verifierMaxAttempts: string;
    retryBaseDelayMinutes: string;
    retryMaxDelayMinutes: string;
    pagingEnabled: boolean;
    pagingStalePendingMinutes: string;
    pagingFailureSharePercent: string;
    oncallChannel: string;
  }) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setSavingExternalExecutionPolicy(true);
    const parsedFailureShare = Number.parseFloat(draft.pagingFailureSharePercent);
    const { error } = await callUntypedRpc<string>('set_governance_public_audit_external_execution_policy', {
      requested_policy_key: 'default',
      requested_policy_name: 'Default external execution policy',
      requested_is_active: true,
      requested_claim_ttl_minutes: parsePositiveInteger(draft.claimTtlMinutes, 10),
      requested_anchor_max_attempts: parsePositiveInteger(draft.anchorMaxAttempts, 5),
      requested_verifier_max_attempts: parsePositiveInteger(draft.verifierMaxAttempts, 5),
      requested_retry_base_delay_minutes: parsePositiveInteger(draft.retryBaseDelayMinutes, 5),
      requested_retry_max_delay_minutes: parsePositiveInteger(draft.retryMaxDelayMinutes, 120),
      requested_paging_enabled: draft.pagingEnabled,
      requested_paging_stale_pending_minutes: parsePositiveInteger(draft.pagingStalePendingMinutes, 30),
      requested_paging_failure_share_percent: Number.isFinite(parsedFailureShare) ? parsedFailureShare : 25,
      requested_oncall_channel: draft.oncallChannel.trim() || 'public_audit_ops',
      metadata: {
        source: 'governance_public_audit_automation_panel',
      },
    });

    if (error) {
      console.error('Failed to save public audit external execution policy:', error);
      toast.error('Could not save external execution policy.');
      setSavingExternalExecutionPolicy(false);
      return;
    }

    toast.success('External execution policy saved.');
    setSavingExternalExecutionPolicy(false);
    await loadAutomationData();
  }, [automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const drainExternalExecutionQueue = useCallback(async (draft: {
    anchorLimit: string;
    verifierLimit: string;
    workerIdentity: string;
  }) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setDrainingExternalExecutionQueue(true);
    const { data, error } = await callUntypedRpc<unknown[]>('claim_governance_public_audit_external_execution_jobs', {
      requested_batch_id: args.latestBatchId,
      requested_anchor_limit: parsePositiveInteger(draft.anchorLimit, 6),
      requested_verifier_limit: parsePositiveInteger(draft.verifierLimit, 10),
      worker_identity: draft.workerIdentity.trim() || null,
    });

    if (error) {
      console.error('Failed to drain public audit external execution queue:', error);
      toast.error('Could not claim external execution jobs.');
      setDrainingExternalExecutionQueue(false);
      return;
    }

    const claimedJobs = readGovernancePublicAuditClaimedExecutionJobs(data);
    const anchorClaims = claimedJobs.filter((job) => job.jobType === 'anchor').length;
    const verifierClaims = claimedJobs.filter((job) => job.jobType === 'verifier').length;
    if (claimedJobs.length === 0) {
      toast.success('No ready external execution jobs were available.');
    } else {
      toast.success(`Claimed ${anchorClaims} anchor and ${verifierClaims} verifier job${verifierClaims === 1 ? '' : 's'}.`);
    }
    setDrainingExternalExecutionQueue(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const evaluateExternalExecutionPaging = useCallback(async (autoOpenPages = true) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setEvaluatingExternalExecutionPaging(true);
    const { data, error } = await callUntypedRpc<unknown[]>('governance_public_audit_external_execution_paging_summary', {
      requested_batch_id: args.latestBatchId,
      auto_open_pages: autoOpenPages,
      requested_lookback_hours: 24,
    });

    if (error) {
      console.error('Failed to evaluate public audit external execution paging summary:', error);
      toast.error('Could not evaluate paging state.');
      setEvaluatingExternalExecutionPaging(false);
      return;
    }

    const summary = readGovernancePublicAuditExternalExecutionPagingSummary(data);
    setEvaluatingExternalExecutionPaging(false);
    if (!summary) {
      toast.success('No eligible batch available for paging evaluation.');
      await loadAutomationData();
      return;
    }

    if (summary.shouldPage) {
      toast.error(`Paging thresholds breached for ${summary.oncallChannel}. Open pages: ${summary.openPageCount}.`);
    } else {
      toast.success('Paging thresholds are within policy.');
    }
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const resolveExternalExecutionPage = useCallback(async (targetPageId: string, resolutionNotes: string) => {
    if (!canManageAutomation || automationBackendUnavailable) return;
    if (!targetPageId) return;

    setResolvingExternalExecutionPage(true);
    const { error } = await callUntypedRpc<string>('resolve_governance_public_audit_external_execution_page', {
      target_page_id: targetPageId,
      resolution_notes: resolutionNotes.trim() || null,
    });

    if (error) {
      console.error('Failed to resolve public audit external execution page:', error);
      toast.error('Could not resolve external execution page.');
      setResolvingExternalExecutionPage(false);
      return;
    }

    toast.success('External execution page resolved.');
    setResolvingExternalExecutionPage(false);
    await loadAutomationData();
  }, [automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const completeAnchorExecutionJob = useCallback(async (draft: {
    jobId: string;
    completionStatus: GovernancePublicAuditAnchorExecutionJobStatus;
    immutableReference: string;
    blockHeight: string;
    errorMessage: string;
  }) => {
    if (!canManageAutomation || automationBackendUnavailable) return;
    if (!draft.jobId) {
      toast.error('Select an anchor execution job first.');
      return;
    }

    const completionStatus = draft.completionStatus;
    const immutableReference = draft.immutableReference.trim();
    if (completionStatus === 'completed' && !immutableReference) {
      toast.error('Immutable reference is required when marking completed.');
      return;
    }

    setCompletingAnchorExecutionJob(true);
    const parsedBlockHeight = Number.parseInt(draft.blockHeight, 10);
    const { error } = await callUntypedRpc<string>('complete_governance_public_audit_anchor_execution_job', {
      target_job_id: draft.jobId,
      completion_status: completionStatus,
      immutable_reference: completionStatus === 'completed' ? immutableReference : null,
      proof_block_height: completionStatus === 'completed' && Number.isFinite(parsedBlockHeight) ? parsedBlockHeight : null,
      error_message: draft.errorMessage.trim() || null,
      proof_payload: {
        source: 'governance_public_audit_automation_panel',
      },
      retry_on_failure: true,
    });

    if (error) {
      console.error('Failed to complete public audit anchor execution job:', error);
      toast.error('Could not save anchor execution job result.');
      setCompletingAnchorExecutionJob(false);
      return;
    }

    toast.success('Anchor execution job updated.');
    setCompletingAnchorExecutionJob(false);
    await loadAutomationData();
  }, [automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  const completeVerifierJob = useCallback(async (draft: {
    jobId: string;
    completionStatus: Database['public']['Enums']['governance_public_audit_verifier_job_status'];
    verificationStatus: Database['public']['Enums']['governance_public_audit_verification_status'];
    verificationHash: string;
    proofReference: string;
    errorMessage: string;
  }) => {
    if (!canManageAutomation || automationBackendUnavailable) return;
    if (!draft.jobId) {
      toast.error('Select a verifier job first.');
      return;
    }

    setCompletingVerifierJob(true);
    const { error } = await callUntypedRpc<string>('complete_governance_public_audit_verifier_job', {
      target_job_id: draft.jobId,
      completion_status: draft.completionStatus,
      verification_status: draft.completionStatus === 'completed' ? draft.verificationStatus : null,
      verification_hash: draft.verificationHash.trim() || null,
      proof_reference: draft.proofReference.trim() || null,
      error_message: draft.errorMessage.trim() || null,
      proof_payload: {
        source: 'governance_public_audit_automation_panel',
      },
      retry_on_failure: true,
    });

    if (error) {
      console.error('Failed to complete public audit verifier job:', error);
      toast.error('Could not complete verifier job.');
      setCompletingVerifierJob(false);
      return;
    }

    toast.success('Verifier job updated.');
    setCompletingVerifierJob(false);
    await loadAutomationData();
  }, [automationBackendUnavailable, canManageAutomation, loadAutomationData]);

  return {
    loadingAutomationData,
    automationBackendUnavailable,
    canManageAutomation,
    registeringAnchorAdapter,
    recordingImmutableAnchor,
    schedulingAnchorExecutionJobs,
    schedulingVerifierJobs,
    runningExternalExecutionCycle,
    completingAnchorExecutionJob,
    completingVerifierJob,
    savingExternalExecutionPolicy,
    drainingExternalExecutionQueue,
    evaluatingExternalExecutionPaging,
    resolvingExternalExecutionPage,
    anchorAdapters,
    immutableAnchors,
    anchorExecutionJobs,
    verifierJobs,
    operationsSlaSummary,
    externalExecutionPolicy,
    externalExecutionPagingSummary,
    externalExecutionPages,
    loadAutomationData,
    registerAnchorAdapter,
    recordImmutableAnchor,
    scheduleAnchorExecutionJobs,
    scheduleVerifierJobs,
    runExternalExecutionCycle,
    saveExternalExecutionPolicy,
    drainExternalExecutionQueue,
    evaluateExternalExecutionPaging,
    resolveExternalExecutionPage,
    completeAnchorExecutionJob,
    completeVerifierJob,
  };
}
