import { describe, expect, it } from 'vitest';

import {
  formatGovernanceGuardianRelayDistributionReadinessIssue,
  formatGovernanceGuardianRelayOpsReadinessIssue,
  readGovernanceGuardianRelayDistributionReadinessIssues,
  readGovernanceGuardianRelayOpsReadinessIssues,
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

  it('returns null for empty or invalid client verification package RPC payloads', () => {
    expect(readGovernanceProposalGuardianRelayClientVerificationPackage(null)).toBeNull();
    expect(readGovernanceProposalGuardianRelayClientVerificationPackage([])).toBeNull();
    expect(
      readGovernanceProposalGuardianRelayClientVerificationPackage([
        {
          package_version: '',
          package_hash: 'h',
          package_payload: {},
          source_manifest_id: 'm1',
          source_manifest_hash: 'mh',
          trust_minimized_quorum_met: false,
          relay_ops_ready: false,
        },
      ]),
    ).toBeNull();
  });

  it('returns null for empty distribution summary payloads', () => {
    expect(readGovernanceProposalGuardianRelayClientVerificationDistributionSummary(null)).toBeNull();
    expect(readGovernanceProposalGuardianRelayClientVerificationDistributionSummary([])).toBeNull();
  });

  it('returns empty lists for non-array recent package or signature inputs', () => {
    expect(readGovernanceProposalGuardianRelayRecentClientVerificationPackageRows(null)).toEqual([]);
    expect(readGovernanceProposalGuardianRelayClientVerificationSignatureRows({})).toEqual([]);
  });

  it('drops recent package rows missing required identifiers', () => {
    expect(
      readGovernanceProposalGuardianRelayRecentClientVerificationPackageRows([
        {
          package_id: '',
          captured_at: '2026-04-21T01:00:00.000Z',
          package_version: 'v1',
          package_hash: 'h',
          source_manifest_hash: 'mh',
          signature_count: 0,
          distribution_ready: false,
          package_notes: null,
        },
      ]),
    ).toEqual([]);
  });

  it('defaults missing signature metadata fields for steward tables', () => {
    const parsed = readGovernanceProposalGuardianRelayClientVerificationSignatureRows([
      {
        signature_id: 'sig-2',
        package_id: 'pkg-2',
        package_hash: 'pkg_hash_2',
        signer_key: 'signer.beta',
        signed_at: '2026-04-21T02:00:00.000Z',
      },
    ]);

    expect(parsed).toEqual([
      {
        signatureId: 'sig-2',
        packageId: 'pkg-2',
        packageHash: 'pkg_hash_2',
        signerKey: 'signer.beta',
        signatureAlgorithm: 'unknown',
        distributionChannel: 'primary',
        signerTrustDomain: 'public',
        signerJurisdictionCountryCode: null,
        signedAt: '2026-04-21T02:00:00.000Z',
      },
    ]);
  });

  it('derives guardian relay ops and distribution readiness issues', () => {
    const opsIssues = readGovernanceGuardianRelayOpsReadinessIssues({
      policyKey: 'guardian_relay_default',
      requireTrustMinimizedQuorum: true,
      requireRelayOpsReadiness: true,
      maxOpenCriticalRelayAlerts: 0,
      relayAttestationSlaMinutes: 120,
      externalApprovalCount: 1,
      staleSignerCount: 2,
      openWarningAlertCount: 1,
      openCriticalAlertCount: 1,
      lastWorkerRunAt: null,
      lastWorkerRunStatus: 'degraded',
      trustMinimizedQuorumMet: false,
      relayOpsReady: false,
    });
    expect(opsIssues).toEqual([
      'trust_minimized_quorum_not_met',
      'critical_alert_budget_exceeded',
      'stale_signers_present',
      'worker_run_not_ok',
      'relay_ops_not_ready',
    ]);

    const distributionIssues = readGovernanceGuardianRelayDistributionReadinessIssues({
      distributionSummary: {
        packageId: 'pkg-1',
        capturedAt: '2026-04-21T01:00:00.000Z',
        packageVersion: 'guardian_relay_client_verification_package_v1',
        packageHash: 'pkg_hash_1',
        sourceManifestHash: 'manifest_hash_1',
        requiredDistributionSignatures: 3,
        signatureCount: 1,
        distinctSignerCount: 1,
        distinctSignerJurisdictionsCount: 1,
        distinctSignerTrustDomainsCount: 1,
        lastSignedAt: null,
        distributionReady: false,
      },
      relayOperationsSummary: {
        policyKey: 'guardian_relay_default',
        requireTrustMinimizedQuorum: true,
        requireRelayOpsReadiness: true,
        maxOpenCriticalRelayAlerts: 1,
        relayAttestationSlaMinutes: 120,
        externalApprovalCount: 1,
        staleSignerCount: 0,
        openWarningAlertCount: 0,
        openCriticalAlertCount: 0,
        lastWorkerRunAt: null,
        lastWorkerRunStatus: 'ok',
        trustMinimizedQuorumMet: true,
        relayOpsReady: false,
      },
    });
    expect(distributionIssues).toEqual([
      'distribution_signatures_below_required',
      'relay_ops_not_ready',
      'distribution_gate_not_ready',
    ]);
  });

  it('formats guardian relay readiness issue labels', () => {
    expect(formatGovernanceGuardianRelayOpsReadinessIssue('stale_signers_present')).toContain('stale');
    expect(formatGovernanceGuardianRelayDistributionReadinessIssue('distribution_gate_not_ready')).toContain('gate');
  });
});
