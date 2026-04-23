import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  isMissingGuardianMultisigBackend,
  type GuardianExternalSignerRow,
  type GuardianMultisigPolicyRow,
} from '@/lib/governance-guardian-multisig';

const DEFAULT_POLICY_KEY = 'guardian_threshold_default';

export function useGovernanceGuardianMultisig(args: { profileId: string | null | undefined }) {
  const [loadingGuardianMultisig, setLoadingGuardianMultisig] = useState(true);
  const [guardianMultisigBackendUnavailable, setGuardianMultisigBackendUnavailable] = useState(false);
  const [savingGuardianPolicy, setSavingGuardianPolicy] = useState(false);
  const [addingGuardianSigner, setAddingGuardianSigner] = useState(false);
  const [togglingSignerId, setTogglingSignerId] = useState<string | null>(null);

  const [guardianPolicy, setGuardianPolicy] = useState<GuardianMultisigPolicyRow | null>(null);
  const [guardianSigners, setGuardianSigners] = useState<GuardianExternalSignerRow[]>([]);

  const loadGuardianMultisig = useCallback(async () => {
    setLoadingGuardianMultisig(true);

    const [policyResponse, signersResponse] = await Promise.all([
      supabase
        .from('governance_guardian_multisig_policies')
        .select('*')
        .eq('policy_key', DEFAULT_POLICY_KEY)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('governance_guardian_external_signers')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

    const sharedError = policyResponse.error || signersResponse.error;
    if (isMissingGuardianMultisigBackend(sharedError)) {
      setGuardianMultisigBackendUnavailable(true);
      setLoadingGuardianMultisig(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load guardian multisig stewardship data:', {
        policyError: policyResponse.error,
        signersError: signersResponse.error,
      });
      toast.error('Could not load guardian multisig data.');
      setLoadingGuardianMultisig(false);
      return;
    }

    setGuardianPolicy(policyResponse.data ?? null);
    setGuardianSigners(signersResponse.data ?? []);
    setGuardianMultisigBackendUnavailable(false);
    setLoadingGuardianMultisig(false);
  }, []);

  useEffect(() => {
    void loadGuardianMultisig();
  }, [loadGuardianMultisig]);

  const activeSignerCount = useMemo(
    () => guardianSigners.filter((signer) => signer.is_active).length,
    [guardianSigners],
  );

  const saveGuardianPolicy = useCallback(async (draft: {
    isEnabled: boolean;
    requiredExternalApprovals: number;
    network: string;
    contractReference: string;
    notes: string;
  }) => {
    if (!args.profileId || guardianMultisigBackendUnavailable) return;

    setSavingGuardianPolicy(true);

    const payload = {
      policy_key: DEFAULT_POLICY_KEY,
      policy_name: 'Guardian Threshold External Multisig',
      is_enabled: draft.isEnabled,
      required_external_approvals: Math.max(1, Math.floor(draft.requiredExternalApprovals || 1)),
      network: draft.network.trim() || null,
      contract_reference: draft.contractReference.trim() || null,
      notes: draft.notes.trim() || null,
      metadata: {
        source: 'governance_admin_multisig_card',
      },
      updated_by: args.profileId,
    };

    const { error } = await supabase
      .from('governance_guardian_multisig_policies')
      .upsert(payload, { onConflict: 'policy_key' });

    if (error) {
      console.error('Failed to save guardian multisig policy:', error);
      toast.error('Could not save guardian multisig policy.');
      setSavingGuardianPolicy(false);
      return;
    }

    toast.success('Guardian multisig policy saved.');
    setSavingGuardianPolicy(false);
    await loadGuardianMultisig();
  }, [args.profileId, guardianMultisigBackendUnavailable, loadGuardianMultisig]);

  const addGuardianSigner = useCallback(async (draft: {
    signerKey: string;
    signerLabel: string;
    keyAlgorithm: string;
    custodyProvider: string;
  }) => {
    if (!args.profileId || guardianMultisigBackendUnavailable) return;

    const signerKey = draft.signerKey.trim();
    if (!signerKey) {
      toast.error('Signer key is required.');
      return;
    }

    setAddingGuardianSigner(true);

    const { error } = await supabase
      .from('governance_guardian_external_signers')
      .insert({
        signer_key: signerKey,
        signer_label: draft.signerLabel.trim() || null,
        key_algorithm: draft.keyAlgorithm.trim() || 'ECDSA_P256_SHA256_V1',
        custody_provider: draft.custodyProvider.trim() || null,
        added_by: args.profileId,
        metadata: {
          source: 'governance_admin_multisig_card',
        },
      });

    if (error) {
      console.error('Failed to add guardian external signer:', error);
      toast.error('Could not add guardian external signer.');
      setAddingGuardianSigner(false);
      return;
    }

    toast.success('Guardian external signer added.');
    setAddingGuardianSigner(false);
    await loadGuardianMultisig();
  }, [args.profileId, guardianMultisigBackendUnavailable, loadGuardianMultisig]);

  const setGuardianSignerActive = useCallback(async (signerId: string, isActive: boolean) => {
    if (guardianMultisigBackendUnavailable) return;

    setTogglingSignerId(signerId);

    const { error } = await supabase
      .from('governance_guardian_external_signers')
      .update({
        is_active: isActive,
      })
      .eq('id', signerId);

    if (error) {
      console.error('Failed to update guardian external signer status:', { signerId, error });
      toast.error('Could not update guardian external signer status.');
      setTogglingSignerId(null);
      return;
    }

    toast.success(isActive ? 'Guardian signer activated.' : 'Guardian signer deactivated.');
    setTogglingSignerId(null);
    await loadGuardianMultisig();
  }, [guardianMultisigBackendUnavailable, loadGuardianMultisig]);

  return {
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
    refreshGuardianMultisig: loadGuardianMultisig,
  };
}
