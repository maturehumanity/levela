import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  isMissingPublicAuditAutomationBackend,
  readGovernancePublicAuditAnchorExecutionJobBoardRows,
  readGovernancePublicAuditExternalExecutionCycleResult,
  readGovernancePublicAuditOperationsSlaSummary,
  type GovernancePublicAuditAnchorAdapterRow,
  type GovernancePublicAuditAnchorExecutionJobBoardRow,
  type GovernancePublicAuditAnchorExecutionJobStatus,
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
  const [anchorAdapters, setAnchorAdapters] = useState<GovernancePublicAuditAnchorAdapterRow[]>([]);
  const [immutableAnchors, setImmutableAnchors] = useState<GovernancePublicAuditImmutableAnchorRow[]>([]);
  const [anchorExecutionJobs, setAnchorExecutionJobs] = useState<GovernancePublicAuditAnchorExecutionJobBoardRow[]>([]);
  const [verifierJobs, setVerifierJobs] = useState<GovernancePublicAuditVerifierJobRow[]>([]);
  const [operationsSlaSummary, setOperationsSlaSummary] = useState<GovernancePublicAuditOperationsSlaSummary | null>(null);
  const loadAutomationData = useCallback(async () => {
    setLoadingAutomationData(true);
    const [
      adapterResponse,
      anchorResponse,
      verifierJobsResponse,
      permissionResponse,
      slaSummaryResponse,
      anchorExecutionBoardResponse,
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
    ]);
    const sharedError =
      adapterResponse.error
      || anchorResponse.error
      || verifierJobsResponse.error
      || permissionResponse.error
      || slaSummaryResponse.error
      || anchorExecutionBoardResponse.error;
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
    toast.success(count > 0 ? `Scheduled ${count} anchor execution job${count === 1 ? '' : 's'}.` : 'No additional anchor execution jobs needed.');
    setSchedulingAnchorExecutionJobs(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);
  const scheduleVerifierJobs = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;
    setSchedulingVerifierJobs(true);
    const { data, error } = await supabase.rpc('schedule_governance_public_audit_verifier_jobs', {
      target_batch_id: args.latestBatchId,
      force_reschedule: forceReschedule,
    });
    if (error) {
      console.error('Failed to schedule public audit verifier jobs:', error);
      toast.error('Could not schedule verifier jobs.');
      setSchedulingVerifierJobs(false);
      return;
    }
    const count = typeof data === 'number' ? data : 0;
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
      toast.success(`External execution cycle scheduled ${summary.anchorJobsScheduled} anchor and ${summary.verifierJobsScheduled} verifier job${summary.verifierJobsScheduled === 1 ? '' : 's'}.`);
    }
    setRunningExternalExecutionCycle(false);
    await loadAutomationData();
  }, [args.latestBatchId, automationBackendUnavailable, canManageAutomation, loadAutomationData]);
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
    const { error } = await supabase.rpc('complete_governance_public_audit_verifier_job', {
      target_job_id: draft.jobId,
      completion_status: draft.completionStatus,
      verification_status: draft.completionStatus === 'completed' ? draft.verificationStatus : null,
      verification_hash: draft.verificationHash.trim() || null,
      proof_reference: draft.proofReference.trim() || null,
      error_message: draft.errorMessage.trim() || null,
      proof_payload: {
        source: 'governance_public_audit_automation_panel',
      },
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
    anchorAdapters,
    immutableAnchors,
    anchorExecutionJobs,
    verifierJobs,
    operationsSlaSummary,
    loadAutomationData,
    registerAnchorAdapter,
    recordImmutableAnchor,
    scheduleAnchorExecutionJobs,
    scheduleVerifierJobs,
    runExternalExecutionCycle,
    completeAnchorExecutionJob,
    completeVerifierJob,
  };
}
