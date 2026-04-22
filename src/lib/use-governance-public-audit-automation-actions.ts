import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  readGovernancePublicAuditClaimedExecutionJobs,
  readGovernancePublicAuditExternalExecutionCycleResult,
  readGovernancePublicAuditExternalExecutionPagingSummary,
} from '@/lib/governance-public-audit-automation';
import { callUntypedRpc } from '@/lib/governance-rpc';
import { useGovernancePublicAuditAutomationCompletionActions } from '@/lib/use-governance-public-audit-automation-completion-actions';

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

interface UseGovernancePublicAuditAutomationActionsArgs {
  latestBatchId: string | null;
  canManageAutomation: boolean;
  automationBackendUnavailable: boolean;
  loadAutomationData: () => Promise<void>;
}

export function useGovernancePublicAuditAutomationActions({
  latestBatchId,
  canManageAutomation,
  automationBackendUnavailable,
  loadAutomationData,
}: UseGovernancePublicAuditAutomationActionsArgs) {
  const [registeringAnchorAdapter, setRegisteringAnchorAdapter] = useState(false);
  const [recordingImmutableAnchor, setRecordingImmutableAnchor] = useState(false);
  const [schedulingAnchorExecutionJobs, setSchedulingAnchorExecutionJobs] = useState(false);
  const [schedulingVerifierJobs, setSchedulingVerifierJobs] = useState(false);
  const [runningExternalExecutionCycle, setRunningExternalExecutionCycle] = useState(false);
  const [savingExternalExecutionPolicy, setSavingExternalExecutionPolicy] = useState(false);
  const [drainingExternalExecutionQueue, setDrainingExternalExecutionQueue] = useState(false);
  const [evaluatingExternalExecutionPaging, setEvaluatingExternalExecutionPaging] = useState(false);
  const [resolvingExternalExecutionPage, setResolvingExternalExecutionPage] = useState(false);

  const completionActions = useGovernancePublicAuditAutomationCompletionActions({
    canManageAutomation,
    automationBackendUnavailable,
    loadAutomationData,
  });

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
      metadata: { source: 'governance_public_audit_automation_panel' },
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
    if (!canManageAutomation || automationBackendUnavailable || !latestBatchId) return;
    const immutableReference = draft.immutableReference.trim();
    if (!immutableReference) {
      toast.error('Immutable reference is required.');
      return;
    }

    setRecordingImmutableAnchor(true);
    const parsedBlockHeight = Number.parseInt(draft.blockHeight, 10);
    const { error } = await supabase.rpc('record_governance_public_audit_immutable_anchor', {
      target_batch_id: latestBatchId,
      target_adapter_id: draft.adapterId || null,
      target_network: draft.network.trim() || null,
      immutable_reference: immutableReference,
      proof_payload: { source: 'governance_public_audit_automation_panel' },
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
  }, [automationBackendUnavailable, canManageAutomation, latestBatchId, loadAutomationData]);

  const scheduleAnchorExecutionJobs = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setSchedulingAnchorExecutionJobs(true);
    const { data, error } = await callUntypedRpc<number>('schedule_governance_public_audit_anchor_execution_jobs', {
      target_batch_id: latestBatchId,
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
  }, [automationBackendUnavailable, canManageAutomation, latestBatchId, loadAutomationData]);

  const scheduleVerifierJobs = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setSchedulingVerifierJobs(true);
    const { data, error } = await callUntypedRpc<number>('schedule_governance_public_audit_verifier_jobs', {
      target_batch_id: latestBatchId,
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
  }, [automationBackendUnavailable, canManageAutomation, latestBatchId, loadAutomationData]);

  const runExternalExecutionCycle = useCallback(async (forceReschedule = false) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setRunningExternalExecutionCycle(true);
    const { data, error } = await callUntypedRpc<unknown[]>('run_governance_public_audit_external_execution_cycle', {
      target_batch_id: latestBatchId,
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
  }, [automationBackendUnavailable, canManageAutomation, latestBatchId, loadAutomationData]);

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
      metadata: { source: 'governance_public_audit_automation_panel' },
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
      requested_batch_id: latestBatchId,
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
  }, [automationBackendUnavailable, canManageAutomation, latestBatchId, loadAutomationData]);

  const evaluateExternalExecutionPaging = useCallback(async (autoOpenPages = true) => {
    if (!canManageAutomation || automationBackendUnavailable) return;

    setEvaluatingExternalExecutionPaging(true);
    const { data, error } = await callUntypedRpc<unknown[]>('governance_public_audit_external_execution_paging_summary', {
      requested_batch_id: latestBatchId,
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
  }, [automationBackendUnavailable, canManageAutomation, latestBatchId, loadAutomationData]);

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

  return {
    registeringAnchorAdapter,
    recordingImmutableAnchor,
    schedulingAnchorExecutionJobs,
    schedulingVerifierJobs,
    runningExternalExecutionCycle,
    completingAnchorExecutionJob: completionActions.completingAnchorExecutionJob,
    completingVerifierJob: completionActions.completingVerifierJob,
    savingExternalExecutionPolicy,
    drainingExternalExecutionQueue,
    evaluatingExternalExecutionPaging,
    resolvingExternalExecutionPage,
    registerAnchorAdapter,
    recordImmutableAnchor,
    scheduleAnchorExecutionJobs,
    scheduleVerifierJobs,
    runExternalExecutionCycle,
    saveExternalExecutionPolicy,
    drainExternalExecutionQueue,
    evaluateExternalExecutionPaging,
    resolveExternalExecutionPage,
    completeAnchorExecutionJob: completionActions.completeAnchorExecutionJob,
    completeVerifierJob: completionActions.completeVerifierJob,
  };
}
