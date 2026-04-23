import { describe, expect, it } from 'vitest';

import {
  readGovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  readGovernancePublicAuditVerifierFederationPackage,
  readGovernancePublicAuditVerifierFederationPackageDistributionSummary,
  readGovernancePublicAuditVerifierFederationPackageHistoryRows,
  readGovernancePublicAuditVerifierFederationPackageSignatureRows,
  readGovernancePublicAuditVerifierFederationRecentPackageRows,
} from '@/lib/governance-public-audit-verifier-federation-distribution';

describe('governance-public-audit-verifier-federation-distribution helpers', () => {
  it('parses verifier federation distribution package rows', () => {
    const parsed = readGovernancePublicAuditVerifierFederationPackage([
      {
        package_version: 'public_audit_verifier_federation_distribution_package_v1',
        package_hash: 'pkg-hash-1',
        package_payload: {
          batch_id: 'batch-1',
        },
        batch_id: 'batch-1',
        source_directory_id: 'directory-1',
        source_directory_hash: 'directory-hash-1',
        federation_ops_ready: true,
      },
    ]);

    expect(parsed).toEqual({
      packageVersion: 'public_audit_verifier_federation_distribution_package_v1',
      packageHash: 'pkg-hash-1',
      packagePayload: {
        batch_id: 'batch-1',
      },
      batchId: 'batch-1',
      sourceDirectoryId: 'directory-1',
      sourceDirectoryHash: 'directory-hash-1',
      federationOpsReady: true,
      digestSourceText: null,
    });
  });

  it('parses digest_source_text when present', () => {
    const parsed = readGovernancePublicAuditVerifierFederationPackage([
      {
        package_version: 'public_audit_verifier_federation_distribution_package_v1',
        package_hash: 'pkg-hash-1',
        package_payload: { batch_id: 'batch-1' },
        batch_id: 'batch-1',
        source_directory_id: 'directory-1',
        source_directory_hash: 'directory-hash-1',
        federation_ops_ready: true,
        digest_source_text: '{"batch_id":"batch-1"}',
      },
    ]);

    expect(parsed?.digestSourceText).toBe('{"batch_id":"batch-1"}');
  });

  it('parses verifier federation distribution package history rows', () => {
    const rows = readGovernancePublicAuditVerifierFederationPackageHistoryRows([
      {
        package_id: 'package-1',
        batch_id: 'batch-1',
        captured_at: '2026-04-22T03:00:00.000Z',
        package_version: 'public_audit_verifier_federation_distribution_package_v1',
        package_hash: 'pkg-hash-1',
        source_directory_id: 'directory-1',
        signature_count: 3,
      },
    ]);

    expect(rows).toEqual([
      {
        packageId: 'package-1',
        batchId: 'batch-1',
        capturedAt: '2026-04-22T03:00:00.000Z',
        packageVersion: 'public_audit_verifier_federation_distribution_package_v1',
        packageHash: 'pkg-hash-1',
        sourceDirectoryId: 'directory-1',
        signatureCount: 3,
      },
    ]);
  });

  it('parses verifier federation package board and signature rows', () => {
    const packages = readGovernancePublicAuditVerifierFederationRecentPackageRows([
      {
        id: 'package-1',
        batch_id: 'batch-1',
        captured_at: '2026-04-22T03:00:00.000Z',
        package_version: 'public_audit_verifier_federation_distribution_package_v1',
        package_hash: 'pkg-hash-1',
        source_directory_id: 'directory-1',
        source_directory_hash: 'directory-hash-1',
        signature_count: 2,
        distribution_ready: true,
        metadata: {
          notes: 'daily capture',
        },
      },
    ]);
    const signatures = readGovernancePublicAuditVerifierFederationPackageSignatureRows([
      {
        signature_id: 'signature-1',
        package_id: 'package-1',
        package_hash: 'pkg-hash-1',
        signer_key: 'signer.alpha',
        signature_algorithm: 'ed25519',
        distribution_channel: 'primary',
        signer_trust_domain: 'public',
        signer_jurisdiction_country_code: 'US',
        signed_at: '2026-04-22T03:03:00.000Z',
      },
    ]);

    expect(packages).toEqual([
      {
        packageId: 'package-1',
        batchId: 'batch-1',
        capturedAt: '2026-04-22T03:00:00.000Z',
        packageVersion: 'public_audit_verifier_federation_distribution_package_v1',
        packageHash: 'pkg-hash-1',
        sourceDirectoryId: 'directory-1',
        sourceDirectoryHash: 'directory-hash-1',
        signatureCount: 2,
        distributionReady: true,
        packageNotes: 'daily capture',
      },
    ]);
    expect(signatures).toEqual([
      {
        signatureId: 'signature-1',
        packageId: 'package-1',
        packageHash: 'pkg-hash-1',
        signerKey: 'signer.alpha',
        signatureAlgorithm: 'ed25519',
        distributionChannel: 'primary',
        signerTrustDomain: 'public',
        signerJurisdictionCountryCode: 'US',
        signedAt: '2026-04-22T03:03:00.000Z',
      },
    ]);
  });

  it('parses verifier federation package distribution summary rows', () => {
    const summary = readGovernancePublicAuditVerifierFederationPackageDistributionSummary([
      {
        package_id: 'package-1',
        batch_id: 'batch-1',
        captured_at: '2026-04-22T03:00:00.000Z',
        package_version: 'public_audit_verifier_federation_distribution_package_v1',
        package_hash: 'pkg-hash-1',
        source_directory_hash: 'directory-hash-1',
        required_distribution_signatures: 2,
        signature_count: 2,
        distinct_signer_count: 2,
        distinct_signer_jurisdictions_count: 2,
        distinct_signer_trust_domains_count: 1,
        last_signed_at: '2026-04-22T03:03:00.000Z',
        federation_ops_ready: true,
        distribution_ready: true,
      },
    ]);

    expect(summary).toEqual({
      packageId: 'package-1',
      batchId: 'batch-1',
      capturedAt: '2026-04-22T03:00:00.000Z',
      packageVersion: 'public_audit_verifier_federation_distribution_package_v1',
      packageHash: 'pkg-hash-1',
      sourceDirectoryHash: 'directory-hash-1',
      requiredDistributionSignatures: 2,
      signatureCount: 2,
      distinctSignerCount: 2,
      distinctSignerJurisdictionsCount: 2,
      distinctSignerTrustDomainsCount: 1,
      lastSignedAt: '2026-04-22T03:03:00.000Z',
      federationOpsReady: true,
      distributionReady: true,
    });
  });

  it('parses federation distribution gate snapshot when no package is captured', () => {
    const snapshot = readGovernancePublicAuditVerifierFederationDistributionGateSnapshot([
      {
        package_id: null,
        batch_id: null,
        captured_at: null,
        package_version: null,
        package_hash: null,
        source_directory_hash: null,
        required_distribution_signatures: 2,
        signature_count: 0,
        distinct_signer_count: 0,
        distinct_signer_jurisdictions_count: 0,
        distinct_signer_trust_domains_count: 0,
        last_signed_at: null,
        federation_ops_ready: false,
        distribution_ready: false,
      },
    ]);

    expect(snapshot).toEqual({
      hasCapturedPackage: false,
      packageId: null,
      batchId: null,
      capturedAt: null,
      packageVersion: '',
      packageHash: '',
      sourceDirectoryHash: '',
      requiredDistributionSignatures: 2,
      signatureCount: 0,
      distinctSignerCount: 0,
      distinctSignerJurisdictionsCount: 0,
      distinctSignerTrustDomainsCount: 0,
      lastSignedAt: null,
      federationOpsReady: false,
      distributionReady: false,
    });
    expect(readGovernancePublicAuditVerifierFederationPackageDistributionSummary([
      {
        package_id: null,
        batch_id: null,
        captured_at: null,
        package_version: null,
        package_hash: null,
        source_directory_hash: null,
        required_distribution_signatures: 2,
        signature_count: 0,
        distinct_signer_count: 0,
        distinct_signer_jurisdictions_count: 0,
        distinct_signer_trust_domains_count: 0,
        last_signed_at: null,
        federation_ops_ready: false,
        distribution_ready: false,
      },
    ])).toBeNull();
  });
});
