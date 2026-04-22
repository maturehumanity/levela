import { describe, expect, it } from 'vitest';

import {
  readGovernanceProposalGuardianRelayClientVerificationDistributionSummary,
  readGovernanceProposalGuardianRelayClientVerificationPackage,
  readGovernanceProposalGuardianRelayClientVerificationSignatureRows,
  readGovernanceProposalGuardianRelayRecentClientVerificationPackageRows,
} from '@/lib/governance-guardian-relay-distribution';

describe('governance-guardian-relay-distribution helpers', () => {
  it('parses deterministic client verification package rows', () => {
    const parsed = readGovernanceProposalGuardianRelayClientVerificationPackage([
      {
        package_version: 'guardian_relay_client_verification_package_v1',
        package_hash: 'pkg_hash_1',
        package_payload: {
          proposal_id: 'proposal-1',
        },
        source_manifest_id: 'manifest-1',
        source_manifest_hash: 'manifest_hash_1',
        trust_minimized_quorum_met: true,
        relay_ops_ready: false,
      },
    ]);

    expect(parsed).toEqual({
      packageVersion: 'guardian_relay_client_verification_package_v1',
      packageHash: 'pkg_hash_1',
      packagePayload: {
        proposal_id: 'proposal-1',
      },
      sourceManifestId: 'manifest-1',
      sourceManifestHash: 'manifest_hash_1',
      trustMinimizedQuorumMet: true,
      relayOpsReady: false,
    });
  });

  it('parses recent verification package rows', () => {
    const parsed = readGovernanceProposalGuardianRelayRecentClientVerificationPackageRows([
      {
        package_id: 'pkg-1',
        captured_at: '2026-04-21T01:00:00.000Z',
        package_version: 'guardian_relay_client_verification_package_v1',
        package_hash: 'pkg_hash_1',
        source_manifest_hash: 'manifest_hash_1',
        signature_count: 2,
        distribution_ready: true,
        package_notes: 'Daily package capture',
      },
    ]);

    expect(parsed).toEqual([
      {
        packageId: 'pkg-1',
        capturedAt: '2026-04-21T01:00:00.000Z',
        packageVersion: 'guardian_relay_client_verification_package_v1',
        packageHash: 'pkg_hash_1',
        sourceManifestHash: 'manifest_hash_1',
        signatureCount: 2,
        distributionReady: true,
        packageNotes: 'Daily package capture',
      },
    ]);
  });

  it('parses distribution summary rows', () => {
    const parsed = readGovernanceProposalGuardianRelayClientVerificationDistributionSummary([
      {
        package_id: 'pkg-1',
        captured_at: '2026-04-21T01:00:00.000Z',
        package_version: 'guardian_relay_client_verification_package_v1',
        package_hash: 'pkg_hash_1',
        source_manifest_hash: 'manifest_hash_1',
        required_distribution_signatures: 2,
        signature_count: 2,
        distinct_signer_count: 2,
        distinct_signer_jurisdictions_count: 2,
        distinct_signer_trust_domains_count: 1,
        last_signed_at: '2026-04-21T01:05:00.000Z',
        distribution_ready: true,
      },
    ]);

    expect(parsed).toEqual({
      packageId: 'pkg-1',
      capturedAt: '2026-04-21T01:00:00.000Z',
      packageVersion: 'guardian_relay_client_verification_package_v1',
      packageHash: 'pkg_hash_1',
      sourceManifestHash: 'manifest_hash_1',
      requiredDistributionSignatures: 2,
      signatureCount: 2,
      distinctSignerCount: 2,
      distinctSignerJurisdictionsCount: 2,
      distinctSignerTrustDomainsCount: 1,
      lastSignedAt: '2026-04-21T01:05:00.000Z',
      distributionReady: true,
    });
  });

  it('parses distribution signature rows', () => {
    const parsed = readGovernanceProposalGuardianRelayClientVerificationSignatureRows([
      {
        signature_id: 'sig-1',
        package_id: 'pkg-1',
        package_hash: 'pkg_hash_1',
        signer_key: 'signer.alpha',
        signature_algorithm: 'ed25519',
        distribution_channel: 'primary',
        signer_trust_domain: 'public',
        signer_jurisdiction_country_code: 'US',
        signed_at: '2026-04-21T01:05:00.000Z',
      },
    ]);

    expect(parsed).toEqual([
      {
        signatureId: 'sig-1',
        packageId: 'pkg-1',
        packageHash: 'pkg_hash_1',
        signerKey: 'signer.alpha',
        signatureAlgorithm: 'ed25519',
        distributionChannel: 'primary',
        signerTrustDomain: 'public',
        signerJurisdictionCountryCode: 'US',
        signedAt: '2026-04-21T01:05:00.000Z',
      },
    ]);
  });
});
