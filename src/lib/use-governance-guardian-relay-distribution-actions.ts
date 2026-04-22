import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { callUntypedRpc } from '@/lib/governance-rpc';

interface UseGovernanceGuardianRelayDistributionActionsArgs {
  proposalId: string;
  canManageGuardianRelays: boolean;
  relayBackendUnavailable: boolean;
  loadRelayData: () => Promise<void>;
}

export function useGovernanceGuardianRelayDistributionActions({
  proposalId,
  canManageGuardianRelays,
  relayBackendUnavailable,
  loadRelayData,
}: UseGovernanceGuardianRelayDistributionActionsArgs) {
  const [capturingRelayClientVerificationPackage, setCapturingRelayClientVerificationPackage] = useState(false);
  const [signingRelayClientVerificationPackage, setSigningRelayClientVerificationPackage] = useState(false);

  const captureRelayClientVerificationPackage = useCallback(async (packageNotes: string) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setCapturingRelayClientVerificationPackage(true);

    const { error } = await callUntypedRpc<string>(
      'capture_governance_proposal_guardian_relay_client_verification_package',
      {
        target_proposal_id: proposalId,
        package_notes: packageNotes.trim() || null,
        package_metadata: {
          source: 'governance_guardian_relay_panel',
        },
      },
    );

    if (error) {
      console.error('Failed to capture guardian relay client verification package:', error);
      toast.error('Could not capture relay verification package.');
      setCapturingRelayClientVerificationPackage(false);
      return;
    }

    toast.success('Guardian relay verification package captured.');
    setCapturingRelayClientVerificationPackage(false);
    await loadRelayData();
  }, [canManageGuardianRelays, loadRelayData, proposalId, relayBackendUnavailable]);

  const signRelayClientVerificationPackage = useCallback(async (draft: {
    packageId: string;
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
    signerTrustDomain: string;
    signerJurisdictionCountryCode: string;
    signerIdentityUri: string;
    distributionChannel: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    const packageId = draft.packageId.trim();
    const signerKey = draft.signerKey.trim();
    const signature = draft.signature.trim();
    if (!packageId || !signerKey || !signature) {
      toast.error('Package, signer key, and signature are required.');
      return;
    }

    setSigningRelayClientVerificationPackage(true);

    const { error } = await callUntypedRpc<string>(
      'sign_governance_proposal_guardian_relay_client_verification_package',
      {
        target_package_id: packageId,
        signer_key: signerKey,
        signature,
        signature_algorithm: draft.signatureAlgorithm.trim() || 'ed25519',
        signer_trust_domain: draft.signerTrustDomain.trim().toLowerCase() || 'public',
        signer_jurisdiction_country_code: draft.signerJurisdictionCountryCode.trim().toUpperCase() || null,
        signer_identity_uri: draft.signerIdentityUri.trim() || null,
        distribution_channel: draft.distributionChannel.trim().toLowerCase() || 'primary',
        signature_metadata: {
          source: 'governance_guardian_relay_panel',
        },
      },
    );

    if (error) {
      console.error('Failed to sign guardian relay client verification package:', error);
      toast.error('Could not sign relay verification package.');
      setSigningRelayClientVerificationPackage(false);
      return;
    }

    toast.success('Relay verification package signature recorded.');
    setSigningRelayClientVerificationPackage(false);
    await loadRelayData();
  }, [canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  return {
    capturingRelayClientVerificationPackage,
    signingRelayClientVerificationPackage,
    captureRelayClientVerificationPackage,
    signRelayClientVerificationPackage,
  };
}
