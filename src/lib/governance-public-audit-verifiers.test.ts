import { describe, expect, it } from 'vitest';

import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditClientVerifierBundle,
  readGovernancePublicAuditVerifierMirrorDirectorySummaryRows,
  readGovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  readGovernancePublicAuditVerifierMirrorProbeJobBoardRows,
  readGovernancePublicAuditVerifierMirrorProbeJobSummary,
  readGovernancePublicAuditVerifierMirrorHealthRows,
  readGovernancePublicAuditVerifierSummary,
} from '@/lib/governance-public-audit-verifiers';

describe('governance-public-audit-verifiers helpers', () => {
  it('parses verifier summary rows', () => {
    const summary = readGovernancePublicAuditVerifierSummary([
      {
        active_verifier_count: 3,
        meets_replication_threshold: true,
        mismatch_count: 0,
        network_proof_count: 1,
        policy_enabled: true,
        required_network_proof_count: 1,
        required_verified_count: 2,
        unreachable_count: 0,
        verified_count: 2,
      },
    ]);

    expect(summary).toEqual({
      policyEnabled: true,
      requiredVerifiedCount: 2,
      requiredNetworkProofCount: 1,
      activeVerifierCount: 3,
      verifiedCount: 2,
      mismatchCount: 0,
      unreachableCount: 0,
      networkProofCount: 1,
      meetsReplicationThreshold: true,
    });
  });

  it('parses mirror health rows', () => {
    const rows = readGovernancePublicAuditVerifierMirrorHealthRows([
      {
        mirror_id: 'mirror-1',
        mirror_key: 'mirror_primary',
        mirror_label: 'Primary Mirror',
        endpoint_url: 'https://mirror.example.com',
        mirror_type: 'https_gateway',
        region_code: 'US-WEST',
        jurisdiction_country_code: 'US',
        operator_label: 'Levela Ops',
        is_active: true,
        last_check_at: '2026-04-21T04:00:00.000Z',
        last_check_status: 'ok',
        last_check_latency_ms: 120,
        last_observed_batch_id: 'batch-1',
        last_observed_batch_hash: 'abc',
        last_error_message: null,
        is_stale: false,
        health_status: 'healthy',
      },
    ]);

    expect(rows).toEqual([
      {
        mirrorId: 'mirror-1',
        mirrorKey: 'mirror_primary',
        mirrorLabel: 'Primary Mirror',
        endpointUrl: 'https://mirror.example.com',
        mirrorType: 'https_gateway',
        regionCode: 'US-WEST',
        jurisdictionCountryCode: 'US',
        operatorLabel: 'Levela Ops',
        isActive: true,
        lastCheckAt: '2026-04-21T04:00:00.000Z',
        lastCheckStatus: 'ok',
        lastCheckLatencyMs: 120,
        lastObservedBatchId: 'batch-1',
        lastObservedBatchHash: 'abc',
        lastErrorMessage: null,
        isStale: false,
        healthStatus: 'healthy',
      },
    ]);
  });

  it('parses client verifier bundle rows', () => {
    const bundle = readGovernancePublicAuditClientVerifierBundle([
      {
        bundle_version: 'public_audit_client_verifier_bundle_v1',
        bundle_hash: 'hash-1',
        bundle_payload: {
          generated_at: '2026-04-21T04:00:00.000Z',
          failover_policy: {
            policy_key: 'default',
            policy_name: 'Default mirror failover policy',
            min_healthy_mirrors: 2,
            max_mirror_latency_ms: 2500,
            max_failures_before_cooldown: 2,
            cooldown_minutes: 10,
            prefer_same_region: false,
            required_distinct_regions: 1,
            required_distinct_operators: 1,
            mirror_selection_strategy: 'health_latency_diversity',
            max_mirror_candidates: 8,
          },
          failover_order: [
            {
              mirror_id: 'mirror-1',
              mirror_key: 'mirror_primary',
              mirror_label: 'Primary Mirror',
              region_code: 'US-WEST',
              operator_label: 'Levela Ops',
              health_status: 'healthy',
              last_check_latency_ms: 120,
              failover_rank: 1,
            },
          ],
          signed_directory: {
            directory_hash: 'directory-hash-1',
            signature: 'sig-1',
            signer_key: 'ops_signer',
          },
        },
        healthy_mirror_count: 2,
        quorum_met: true,
      },
    ]);

    expect(bundle).toEqual({
      bundleVersion: 'public_audit_client_verifier_bundle_v1',
      bundleHash: 'hash-1',
      bundlePayload: {
        generated_at: '2026-04-21T04:00:00.000Z',
        failover_policy: {
          policy_key: 'default',
          policy_name: 'Default mirror failover policy',
          min_healthy_mirrors: 2,
          max_mirror_latency_ms: 2500,
          max_failures_before_cooldown: 2,
          cooldown_minutes: 10,
          prefer_same_region: false,
          required_distinct_regions: 1,
          required_distinct_operators: 1,
          mirror_selection_strategy: 'health_latency_diversity',
          max_mirror_candidates: 8,
        },
        failover_order: [
          {
            mirror_id: 'mirror-1',
            mirror_key: 'mirror_primary',
            mirror_label: 'Primary Mirror',
            region_code: 'US-WEST',
            operator_label: 'Levela Ops',
            health_status: 'healthy',
            last_check_latency_ms: 120,
            failover_rank: 1,
          },
        ],
        signed_directory: {
          directory_hash: 'directory-hash-1',
          signature: 'sig-1',
          signer_key: 'ops_signer',
        },
      },
      healthyMirrorCount: 2,
      quorumMet: true,
      failoverPolicy: {
        policyId: null,
        policyKey: 'default',
        policyName: 'Default mirror failover policy',
        isActive: true,
        minHealthyMirrors: 2,
        maxMirrorLatencyMs: 2500,
        maxFailuresBeforeCooldown: 2,
        cooldownMinutes: 10,
        preferSameRegion: false,
        requiredDistinctRegions: 1,
        requiredDistinctOperators: 1,
        mirrorSelectionStrategy: 'health_latency_diversity',
        maxMirrorCandidates: 8,
        updatedAt: null,
      },
      failoverOrder: [
        {
          mirrorId: 'mirror-1',
          mirrorKey: 'mirror_primary',
          mirrorLabel: 'Primary Mirror',
          regionCode: 'US-WEST',
          operatorLabel: 'Levela Ops',
          healthStatus: 'healthy',
          lastCheckLatencyMs: 120,
          failoverRank: 1,
        },
      ],
      signedDirectoryHash: 'directory-hash-1',
      signedDirectorySignature: 'sig-1',
      signedDirectorySignerKey: 'ops_signer',
    });
  });

  it('parses mirror failover policy summary row', () => {
    const summary = readGovernancePublicAuditVerifierMirrorFailoverPolicySummary([
      {
        policy_id: 'policy-1',
        policy_key: 'default',
        policy_name: 'Default mirror failover policy',
        is_active: true,
        min_healthy_mirrors: 2,
        max_mirror_latency_ms: 3000,
        max_failures_before_cooldown: 3,
        cooldown_minutes: 15,
        prefer_same_region: true,
        required_distinct_regions: 2,
        required_distinct_operators: 2,
        mirror_selection_strategy: 'health_latency_diversity',
        max_mirror_candidates: 10,
        updated_at: '2026-04-21T04:30:00.000Z',
      },
    ]);

    expect(summary).toEqual({
      policyId: 'policy-1',
      policyKey: 'default',
      policyName: 'Default mirror failover policy',
      isActive: true,
      minHealthyMirrors: 2,
      maxMirrorLatencyMs: 3000,
      maxFailuresBeforeCooldown: 3,
      cooldownMinutes: 15,
      preferSameRegion: true,
      requiredDistinctRegions: 2,
      requiredDistinctOperators: 2,
      mirrorSelectionStrategy: 'health_latency_diversity',
      maxMirrorCandidates: 10,
      updatedAt: '2026-04-21T04:30:00.000Z',
    });
  });

  it('parses mirror directory summary rows', () => {
    const rows = readGovernancePublicAuditVerifierMirrorDirectorySummaryRows([
      {
        directory_id: 'directory-1',
        batch_id: 'batch-1',
        directory_version: 'public_audit_verifier_mirror_directory_v1',
        directory_hash: 'hash-1',
        signer_id: 'signer-1',
        signer_key: 'ops_signer',
        signer_label: 'Ops Signer',
        trust_tier: 'observer',
        signature: 'sig-1',
        signature_algorithm: 'ed25519',
        published_at: '2026-04-21T05:00:00.000Z',
        is_latest_for_batch: true,
      },
    ]);

    expect(rows).toEqual([
      {
        directoryId: 'directory-1',
        batchId: 'batch-1',
        directoryVersion: 'public_audit_verifier_mirror_directory_v1',
        directoryHash: 'hash-1',
        signerId: 'signer-1',
        signerKey: 'ops_signer',
        signerLabel: 'Ops Signer',
        trustTier: 'observer',
        signature: 'sig-1',
        signatureAlgorithm: 'ed25519',
        publishedAt: '2026-04-21T05:00:00.000Z',
        isLatestForBatch: true,
      },
    ]);
  });

  it('parses mirror probe job summary and board rows', () => {
    const summary = readGovernancePublicAuditVerifierMirrorProbeJobSummary([
      {
        batch_id: 'batch-1',
        pending_sla_minutes: 30,
        lookback_hours: 24,
        pending_count: 1,
        running_count: 1,
        stale_pending_count: 0,
        failed_lookback_count: 2,
        completed_lookback_count: 5,
        oldest_pending_at: '2026-04-21T04:40:00.000Z',
        pending_sla_met: true,
      },
    ]);

    const boardRows = readGovernancePublicAuditVerifierMirrorProbeJobBoardRows([
      {
        job_id: 'job-1',
        batch_id: 'batch-1',
        mirror_id: 'mirror-1',
        mirror_key: 'mirror_primary',
        mirror_label: 'Primary Mirror',
        endpoint_url: 'https://mirror.example.com',
        status: 'pending',
        scheduled_at: '2026-04-21T04:45:00.000Z',
        completed_at: null,
        observed_check_status: null,
        observed_latency_ms: null,
        observed_batch_hash: null,
        error_message: null,
      },
    ]);

    expect(summary).toEqual({
      batchId: 'batch-1',
      pendingSlaMinutes: 30,
      lookbackHours: 24,
      pendingCount: 1,
      runningCount: 1,
      stalePendingCount: 0,
      failedLookbackCount: 2,
      completedLookbackCount: 5,
      oldestPendingAt: '2026-04-21T04:40:00.000Z',
      pendingSlaMet: true,
    });

    expect(boardRows).toEqual([
      {
        jobId: 'job-1',
        batchId: 'batch-1',
        mirrorId: 'mirror-1',
        mirrorKey: 'mirror_primary',
        mirrorLabel: 'Primary Mirror',
        endpointUrl: 'https://mirror.example.com',
        status: 'pending',
        scheduledAt: '2026-04-21T04:45:00.000Z',
        completedAt: null,
        observedCheckStatus: 'unknown',
        observedLatencyMs: null,
        observedBatchHash: null,
        errorMessage: null,
      },
    ]);
  });

  it('detects missing backend errors', () => {
    expect(
      isMissingPublicAuditVerifierBackend({
        code: 'PGRST202',
        message: 'Function governance_public_audit_verifier_mirror_health_summary does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingPublicAuditVerifierBackend({
        code: '22023',
        message: 'random failure',
      }),
    ).toBe(false);
  });
});
