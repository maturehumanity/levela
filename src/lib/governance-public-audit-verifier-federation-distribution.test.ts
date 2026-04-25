import { describe, expect, it } from 'vitest';

import {
  formatGovernancePublicAuditVerifierFederationDistributionReadinessIssue,
  formatGovernancePublicAuditVerifierFederationOpsReadinessIssue,
  readGovernancePublicAuditVerifierFederationDistributionReadinessIssues,
  readGovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  readGovernancePublicAuditVerifierFederationOpsReadinessIssues,
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

  it('returns null for empty or incomplete federation package RPC payloads', () => {
    expect(readGovernancePublicAuditVerifierFederationPackage(null)).toBeNull();
    expect(readGovernancePublicAuditVerifierFederationPackage([])).toBeNull();
    expect(
      readGovernancePublicAuditVerifierFederationPackage([
        {
          package_version: 'public_audit_verifier_federation_distribution_package_v1',
          package_hash: '',
          package_payload: { batch_id: 'batch-1' },
          batch_id: 'batch-1',
          source_directory_id: 'directory-1',
          source_directory_hash: 'directory-hash-1',
          federation_ops_ready: true,
        },
      ]),
    ).toBeNull();
  });

  it('returns empty row lists for non-array federation history or recent package inputs', () => {
    expect(readGovernancePublicAuditVerifierFederationPackageHistoryRows(null)).toEqual([]);
    expect(readGovernancePublicAuditVerifierFederationRecentPackageRows({})).toEqual([]);
  });

  it('returns null for an empty federation distribution gate snapshot payload', () => {
    expect(readGovernancePublicAuditVerifierFederationDistributionGateSnapshot(null)).toBeNull();
    expect(readGovernancePublicAuditVerifierFederationDistributionGateSnapshot([])).toBeNull();
  });

  it('drops federation signature rows missing required identifiers', () => {
    expect(
      readGovernancePublicAuditVerifierFederationPackageSignatureRows([
        {
          signature_id: '',
          package_id: 'pkg-1',
          package_hash: 'h',
          signer_key: 'k',
          signature_algorithm: 'ed25519',
          distribution_channel: 'primary',
          signer_trust_domain: 'public',
          signer_jurisdiction_country_code: 'US',
          signed_at: '2026-04-22T04:00:00.000Z',
        },
      ]),
    ).toEqual([]);
  });

  it('defaults omitted signature metadata on federation package signature rows', () => {
    expect(
      readGovernancePublicAuditVerifierFederationPackageSignatureRows([
        {
          signature_id: 'sig-x',
          package_id: 'pkg-x',
          package_hash: 'hash-x',
          signer_key: 'signer-x',
          signed_at: '2026-04-22T04:05:00.000Z',
        },
      ]),
    ).toEqual([
      {
        signatureId: 'sig-x',
        packageId: 'pkg-x',
        packageHash: 'hash-x',
        signerKey: 'signer-x',
        signatureAlgorithm: 'unknown',
        distributionChannel: 'primary',
        signerTrustDomain: 'public',
        signerJurisdictionCountryCode: null,
        signedAt: '2026-04-22T04:05:00.000Z',
      },
    ]);
  });

  it('derives readiness issue lists for federation operations and distribution gates', () => {
    const opsIssues = readGovernancePublicAuditVerifierFederationOpsReadinessIssues({
      policyKey: 'default',
      requireFederationOpsReadiness: true,
      maxOpenCriticalFederationAlerts: 0,
      minOnboardedFederationOperators: 2,
      registeredOperatorCount: 2,
      approvedOperatorCount: 2,
      onboardedOperatorCount: 1,
      pendingRequestCount: 1,
      approvedRequestCount: 1,
      onboardedRequestCount: 1,
      openWarningAlertCount: 1,
      openCriticalAlertCount: 1,
      alertSlaHours: 12,
      alertSlaBreachedCount: 1,
      lastWorkerRunAt: null,
      lastWorkerRunStatus: 'degraded',
      distributionVerificationLookbackHours: 24,
      lastDistributionVerificationRunAt: null,
      lastDistributionVerificationRunStatus: 'failed',
      distributionVerificationStale: true,
      openDistributionStalePackageAlertCount: 1,
      openDistributionBadSignatureAlertCount: 1,
      openDistributionPolicyMismatchAlertCount: 1,
      openDistributionVerificationAlertCount: 3,
      federationOpsReady: false,
    });

    expect(opsIssues).toEqual([
      'operators_below_minimum',
      'critical_alert_budget_exceeded',
      'alert_sla_breaches_open',
      'distribution_verification_stale',
      'distribution_verification_alerts_open',
      'worker_run_not_ok',
      'federation_ops_not_ready',
    ]);

    const distributionIssues = readGovernancePublicAuditVerifierFederationDistributionReadinessIssues({
      snapshot: {
        hasCapturedPackage: true,
        packageId: 'pkg-1',
        batchId: 'batch-1',
        capturedAt: '2026-04-22T03:00:00.000Z',
        packageVersion: 'v1',
        packageHash: 'hash',
        sourceDirectoryHash: 'dir-hash',
        requiredDistributionSignatures: 3,
        signatureCount: 1,
        distinctSignerCount: 1,
        distinctSignerJurisdictionsCount: 1,
        distinctSignerTrustDomainsCount: 1,
        lastSignedAt: null,
        federationOpsReady: false,
        distributionReady: false,
      },
      federationOperationsSummary: {
        policyKey: 'default',
        requireFederationOpsReadiness: true,
        maxOpenCriticalFederationAlerts: 1,
        minOnboardedFederationOperators: 1,
        registeredOperatorCount: 1,
        approvedOperatorCount: 1,
        onboardedOperatorCount: 1,
        pendingRequestCount: 0,
        approvedRequestCount: 1,
        onboardedRequestCount: 1,
        openWarningAlertCount: 0,
        openCriticalAlertCount: 0,
        alertSlaHours: 12,
        alertSlaBreachedCount: 0,
        lastWorkerRunAt: null,
        lastWorkerRunStatus: 'ok',
        distributionVerificationLookbackHours: 24,
        lastDistributionVerificationRunAt: null,
        lastDistributionVerificationRunStatus: 'ok',
        distributionVerificationStale: false,
        openDistributionStalePackageAlertCount: 0,
        openDistributionBadSignatureAlertCount: 0,
        openDistributionPolicyMismatchAlertCount: 0,
        openDistributionVerificationAlertCount: 0,
        federationOpsReady: false,
      },
    });

    expect(distributionIssues).toEqual([
      'distribution_signatures_below_required',
      'federation_ops_not_ready',
      'distribution_gate_not_ready',
    ]);
  });

  it('formats readiness issue labels for stewardship panels', () => {
    expect(formatGovernancePublicAuditVerifierFederationOpsReadinessIssue('worker_run_not_ok')).toContain('worker run');
    expect(formatGovernancePublicAuditVerifierFederationDistributionReadinessIssue('distribution_gate_not_ready')).toContain('gate');
  });
});
