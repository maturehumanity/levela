import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  readGovernancePublicAuditChainStatus,
  type GovernancePublicAuditBatchRow,
  type GovernancePublicAuditChainStatus,
} from '@/lib/governance-public-audit';

function isMissingPublicAuditBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || message.includes('governance_public_audit_')
    || message.includes('capture_governance_public_audit_batch')
    || message.includes('verify_governance_public_audit_chain')
  );
}

export function useGovernancePublicAuditAnchoring(args: { profileId: string | null | undefined }) {
  const [loadingPublicAudit, setLoadingPublicAudit] = useState(true);
  const [publicAuditBackendUnavailable, setPublicAuditBackendUnavailable] = useState(false);
  const [creatingPublicAuditBatch, setCreatingPublicAuditBatch] = useState(false);
  const [recordingPublicAuditAnchor, setRecordingPublicAuditAnchor] = useState(false);
  const [publicAuditBatches, setPublicAuditBatches] = useState<GovernancePublicAuditBatchRow[]>([]);
  const [publicAuditChainStatus, setPublicAuditChainStatus] = useState<GovernancePublicAuditChainStatus | null>(null);
  const [publicAuditAnchorNetwork, setPublicAuditAnchorNetwork] = useState('external_anchor');
  const [publicAuditAnchorReference, setPublicAuditAnchorReference] = useState('');

  const loadPublicAuditAnchoring = useCallback(async () => {
    setLoadingPublicAudit(true);

    const [batchResponse, chainStatusResponse] = await Promise.all([
      supabase
        .from('governance_public_audit_batches')
        .select('*')
        .order('batch_index', { ascending: false })
        .limit(12),
      supabase.rpc('verify_governance_public_audit_chain', { max_batches: 200 }),
    ]);

    const sharedError = batchResponse.error || chainStatusResponse.error;
    if (isMissingPublicAuditBackend(sharedError)) {
      setPublicAuditBackendUnavailable(true);
      setLoadingPublicAudit(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load public audit anchoring data:', {
        batchesError: batchResponse.error,
        chainError: chainStatusResponse.error,
      });
      toast.error('Could not load public audit anchoring data.');
      setLoadingPublicAudit(false);
      return;
    }

    setPublicAuditBatches((batchResponse.data as GovernancePublicAuditBatchRow[]) || []);
    setPublicAuditChainStatus(readGovernancePublicAuditChainStatus(chainStatusResponse.data));
    setPublicAuditBackendUnavailable(false);
    setLoadingPublicAudit(false);
  }, []);

  useEffect(() => {
    void loadPublicAuditAnchoring();
  }, [loadPublicAuditAnchoring]);

  const handleCapturePublicAuditBatch = useCallback(async () => {
    if (!args.profileId || publicAuditBackendUnavailable) return;

    setCreatingPublicAuditBatch(true);

    const { data: capturedBatchId, error } = await supabase.rpc('capture_governance_public_audit_batch', {
      max_events: 500,
      batch_source: 'steward_manual_batch',
      created_by_profile_id: args.profileId,
      requested_metadata: {
        source: 'governance_admin_public_audit_card',
      },
    });

    if (error) {
      console.error('Failed to capture governance public audit batch:', error);
      toast.error('Could not capture a public audit batch.');
      setCreatingPublicAuditBatch(false);
      return;
    }

    if (!capturedBatchId) {
      toast.success('No pending governance events to batch.');
      setCreatingPublicAuditBatch(false);
      return;
    }

    toast.success('Public audit batch captured.');
    setCreatingPublicAuditBatch(false);
    await loadPublicAuditAnchoring();
  }, [args.profileId, loadPublicAuditAnchoring, publicAuditBackendUnavailable]);

  const handleRecordLatestPublicAuditAnchor = useCallback(async () => {
    if (publicAuditBackendUnavailable) return;

    const latestBatch = publicAuditBatches[0];
    if (!latestBatch) {
      toast.error('No audit batch is available to anchor.');
      return;
    }

    const normalizedReference = publicAuditAnchorReference.trim();
    if (!normalizedReference) {
      toast.error('Enter an anchor reference before recording.');
      return;
    }

    setRecordingPublicAuditAnchor(true);

    const { data: anchored, error } = await supabase.rpc('record_governance_public_audit_anchor', {
      target_batch_id: latestBatch.id,
      anchor_network: publicAuditAnchorNetwork.trim() || 'external_anchor',
      anchor_reference: normalizedReference,
      anchor_metadata: {
        source: 'governance_admin_public_audit_card',
      },
    });

    if (error || !anchored) {
      console.error('Failed to record governance public audit anchor:', { error, anchored });
      toast.error('Could not record the anchor reference.');
      setRecordingPublicAuditAnchor(false);
      return;
    }

    toast.success('Anchor reference recorded for the latest public audit batch.');
    setPublicAuditAnchorReference('');
    setRecordingPublicAuditAnchor(false);
    await loadPublicAuditAnchoring();
  }, [
    loadPublicAuditAnchoring,
    publicAuditAnchorNetwork,
    publicAuditAnchorReference,
    publicAuditBackendUnavailable,
    publicAuditBatches,
  ]);

  return {
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
  };
}
