import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { GovernancePublicAuditAnchorExecutionJobStatus } from '@/lib/governance-public-audit-automation';

interface UseGovernancePublicAuditAutomationCompletionActionsArgs {
  canManageAutomation: boolean;
  automationBackendUnavailable: boolean;
  loadAutomationData: () => Promise<void>;
}

export function useGovernancePublicAuditAutomationCompletionActions({
  canManageAutomation,
  automationBackendUnavailable,
  loadAutomationData,
}: UseGovernancePublicAuditAutomationCompletionActionsArgs) {
  const [completingAnchorExecutionJob, setCompletingAnchorExecutionJob] = useState(false);
  const [completingVerifierJob, setCompletingVerifierJob] = useState(false);

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
    const { error } = await supabase.rpc('complete_governance_public_audit_anchor_execution_job', {
      target_job_id: draft.jobId,
      completion_status: completionStatus,
      immutable_reference: completionStatus === 'completed' ? immutableReference : null,
      proof_block_height: completionStatus === 'completed' && Number.isFinite(parsedBlockHeight) ? parsedBlockHeight : null,
      error_message: draft.errorMessage.trim() || null,
      proof_payload: { source: 'governance_public_audit_automation_panel' },
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
    const { error } = await supabase.rpc('complete_governance_public_audit_verifier_job', {
      target_job_id: draft.jobId,
      completion_status: draft.completionStatus,
      verification_status: draft.completionStatus === 'completed' ? draft.verificationStatus : null,
      verification_hash: draft.verificationHash.trim() || null,
      proof_reference: draft.proofReference.trim() || null,
      error_message: draft.errorMessage.trim() || null,
      proof_payload: { source: 'governance_public_audit_automation_panel' },
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
    completingAnchorExecutionJob,
    completingVerifierJob,
    completeAnchorExecutionJob,
    completeVerifierJob,
  };
}
