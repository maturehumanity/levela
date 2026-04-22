import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { asIntegerOrNull, callUntypedRpc } from '@/lib/governance-rpc';

interface UseGovernancePublicAuditVerifierFederationDistributionActionsArgs {
  latestBatchId: string | null;
  canManageMirrorFederation: boolean;
  federationBackendUnavailable: boolean;
  loadFederationData: () => Promise<void>;
}

export function useGovernancePublicAuditVerifierFederationDistributionActions({
  latestBatchId,
  canManageMirrorFederation,
  federationBackendUnavailable,
  loadFederationData,
}: UseGovernancePublicAuditVerifierFederationDistributionActionsArgs) {
  const [capturingFederationPackage, setCapturingFederationPackage] = useState(false);
  const [signingFederationPackage, setSigningFederationPackage] = useState(false);
  const [verifyingFederationDistribution, setVerifyingFederationDistribution] = useState(false);

  const captureFederationPackage = useCallback(async (packageNotes: string) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    setCapturingFederationPackage(true);
    const { error } = await callUntypedRpc<string>('capture_governance_public_audit_verifier_federation_package', {
      target_batch_id: latestBatchId,
      requested_policy_key: 'default',
      package_notes: packageNotes.trim() || null,
      package_metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to capture verifier federation package:', error);
      const detail = typeof error?.message === 'string' && error.message.trim().length > 0 ? error.message.trim() : null;
      toast.error(detail ?? 'Could not capture verifier federation package.');
      setCapturingFederationPackage(false);
      return;
    }

    toast.success('Verifier federation package captured.');
    setCapturingFederationPackage(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, latestBatchId, loadFederationData]);

  const signFederationPackage = useCallback(async (draft: {
    packageId: string;
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
    signerTrustDomain: string;
    signerJurisdictionCountryCode: string;
    signerIdentityUri: string;
    distributionChannel: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const packageId = draft.packageId.trim();
    const signerKey = draft.signerKey.trim();
    const signature = draft.signature.trim();
    if (!packageId || !signerKey || !signature) {
      toast.error('Package, signer key, and signature are required.');
      return;
    }

    setSigningFederationPackage(true);
    const { error } = await callUntypedRpc<string>('sign_governance_public_audit_verifier_federation_package', {
      target_package_id: packageId,
      signer_key: signerKey,
      signature,
      signature_algorithm: draft.signatureAlgorithm.trim() || 'ed25519',
      signer_trust_domain: draft.signerTrustDomain.trim().toLowerCase() || 'public',
      signer_jurisdiction_country_code: draft.signerJurisdictionCountryCode.trim().toUpperCase() || null,
      signer_identity_uri: draft.signerIdentityUri.trim() || null,
      distribution_channel: draft.distributionChannel.trim().toLowerCase() || 'primary',
      signature_metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to sign verifier federation package:', error);
      const detail = typeof error?.message === 'string' && error.message.trim().length > 0 ? error.message.trim() : null;
      toast.error(detail ?? 'Could not sign verifier federation package.');
      setSigningFederationPackage(false);
      return;
    }

    toast.success('Verifier federation package signature recorded.');
    setSigningFederationPackage(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const runFederationDistributionVerification = useCallback(async (staleAfterHours: string) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    setVerifyingFederationDistribution(true);
    const { data, error } = await callUntypedRpc<Array<{ run_status?: unknown }>>(
      'run_governance_public_audit_verifier_federation_distribution_verification',
      {
        target_batch_id: latestBatchId,
        requested_policy_key: 'default',
        stale_after_hours: asIntegerOrNull(staleAfterHours),
        run_metadata: {
          source: 'governance_public_audit_verifier_panel',
        },
      },
    );

    if (error) {
      console.error('Failed to run verifier federation distribution verification:', error);
      const detail = typeof error?.message === 'string' && error.message.trim().length > 0 ? error.message.trim() : null;
      toast.error(detail ?? 'Could not run federation distribution verification.');
      setVerifyingFederationDistribution(false);
      return;
    }

    const runStatus = typeof data?.[0]?.run_status === 'string'
      ? data[0].run_status.trim().toLowerCase()
      : 'ok';
    if (runStatus === 'ok') {
      toast.success('Federation distribution verification completed.');
    } else {
      toast.warning('Federation distribution verification opened blocking alerts.');
    }
    setVerifyingFederationDistribution(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, latestBatchId, loadFederationData]);

  return {
    capturingFederationPackage,
    signingFederationPackage,
    verifyingFederationDistribution,
    captureFederationPackage,
    signFederationPackage,
    runFederationDistributionVerification,
  };
}
