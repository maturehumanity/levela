import { describe, expect, it } from 'vitest';

import {
  isMissingGuardianRelayBackend,
  readGovernanceProposalGuardianRelayAttestationAuditRows,
  readGovernanceProposalGuardianRelayClientProofManifest,
  readGovernanceProposalGuardianRelayDiversityAudit,
  readGovernanceProposalGuardianRelayRecentClientManifestRows,
  readGovernanceProposalGuardianRelayRecentAuditRows,
  readGovernanceProposalGuardianRelaySummary,
  readGovernanceProposalGuardianRelayTrustMinimizedSummary,
} from '@/lib/governance-guardian-relays';

describe('governance-guardian-relays helpers', () => {
  it('parses relay summary rows', () => {
    const summary = readGovernanceProposalGuardianRelaySummary([
      {
        active_relay_count: 3,
        chain_proof_match_met: true,
        external_approval_count: 2,
        policy_enabled: true,
        relay_mismatch_count: 0,
        relay_quorum_met: true,
        relay_unreachable_count: 0,
        relay_verified_count: 4,
        require_chain_proof_match: true,
        required_relay_attestations: 2,
        signers_with_chain_proof_count: 2,
        signers_with_relay_quorum_count: 2,
      },
    ]);

    expect(summary).toEqual({
      policyEnabled: true,
      requiredRelayAttestations: 2,
      requireChainProofMatch: true,
      activeRelayCount: 3,
      relayVerifiedCount: 4,
      relayMismatchCount: 0,
      relayUnreachableCount: 0,
      signersWithRelayQuorumCount: 2,
      signersWithChainProofCount: 2,
      externalApprovalCount: 2,
      relayQuorumMet: true,
      chainProofMatchMet: true,
    });
  });

  it('parses relay diversity audit rows', () => {
    const parsed = readGovernanceProposalGuardianRelayDiversityAudit([
      {
        policy_enabled: true,
        required_relay_attestations: 2,
        min_distinct_relay_regions: 2,
        min_distinct_relay_providers: 2,
        min_distinct_relay_operators: 2,
        verified_relay_count: 5,
        distinct_regions_count: 3,
        distinct_providers_count: 2,
        distinct_operators_count: 2,
        dominant_region_share_percent: 40,
        dominant_provider_share_percent: 60,
        dominant_operator_share_percent: 40,
        region_diversity_met: true,
        provider_diversity_met: true,
        operator_diversity_met: true,
        overall_diversity_met: true,
      },
    ]);

    expect(parsed).toEqual({
      policyEnabled: true,
      requiredRelayAttestations: 2,
      minDistinctRelayRegions: 2,
      minDistinctRelayProviders: 2,
      minDistinctRelayOperators: 2,
      verifiedRelayCount: 5,
      distinctRegionsCount: 3,
      distinctProvidersCount: 2,
      distinctOperatorsCount: 2,
      dominantRegionSharePercent: 40,
      dominantProviderSharePercent: 60,
      dominantOperatorSharePercent: 40,
      regionDiversityMet: true,
      providerDiversityMet: true,
      operatorDiversityMet: true,
      overallDiversityMet: true,
    });
  });

  it('parses relay attestation audit rows', () => {
    const rows = readGovernanceProposalGuardianRelayAttestationAuditRows([
      {
        relay_id: 'relay-1',
        relay_key: 'relay-key-1',
        relay_label: 'Relay 1',
        relay_region_code: 'US-WEST',
        relay_infrastructure_provider: 'ProviderA',
        relay_operator_label: 'OperatorA',
        relay_trust_domain: 'public',
        total_attestation_count: 10,
        verified_count: 8,
        mismatch_count: 1,
        unreachable_count: 1,
        last_attested_at: '2026-04-20T12:00:00.000Z',
        recent_attestation_count: 5,
        recent_failure_count: 1,
        recent_health_score: 80,
        recent_health_status: 'degraded',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      relayId: 'relay-1',
      relayKey: 'relay-key-1',
      relayRegionCode: 'US-WEST',
      relayInfrastructureProvider: 'ProviderA',
      recentHealthStatus: 'degraded',
      recentHealthScore: 80,
    });
  });

  it('parses recent formal audit snapshots', () => {
    const rows = readGovernanceProposalGuardianRelayRecentAuditRows([
      {
        report_id: 'report-1',
        captured_at: '2026-04-20T12:00:00.000Z',
        overall_diversity_met: true,
        relay_quorum_met: true,
        chain_proof_match_met: false,
        verified_relay_count: 6,
        distinct_regions_count: 3,
        distinct_providers_count: 2,
        distinct_operators_count: 2,
        audit_notes: 'Weekly relay audit',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      reportId: 'report-1',
      capturedAt: '2026-04-20T12:00:00.000Z',
      overallDiversityMet: true,
      relayQuorumMet: true,
      chainProofMatchMet: false,
      verifiedRelayCount: 6,
      distinctRegionsCount: 3,
      distinctProvidersCount: 2,
      distinctOperatorsCount: 2,
      auditNotes: 'Weekly relay audit',
    });
  });

  it('parses trust-minimized relay quorum summary rows', () => {
    const summary = readGovernanceProposalGuardianRelayTrustMinimizedSummary([
      {
        policy_enabled: true,
        required_relay_attestations: 2,
        min_distinct_relay_regions: 2,
        min_distinct_relay_providers: 2,
        min_distinct_relay_operators: 2,
        min_distinct_relay_jurisdictions: 2,
        min_distinct_relay_trust_domains: 1,
        max_dominant_relay_region_share_percent: '80',
        max_dominant_relay_provider_share_percent: '75',
        max_dominant_relay_operator_share_percent: '70',
        max_dominant_relay_jurisdiction_share_percent: '80',
        max_dominant_relay_trust_domain_share_percent: '90',
        external_approval_count: 3,
        signers_with_relay_quorum_count: 3,
        signers_with_chain_proof_count: 3,
        verified_relay_count: 6,
        distinct_regions_count: 3,
        distinct_providers_count: 3,
        distinct_operators_count: 3,
        distinct_jurisdictions_count: 2,
        distinct_trust_domains_count: 1,
        dominant_region_share_percent: 40,
        dominant_provider_share_percent: 30,
        dominant_operator_share_percent: 40,
        dominant_jurisdiction_share_percent: '50',
        dominant_trust_domain_share_percent: '80',
        relay_quorum_met: true,
        chain_proof_match_met: true,
        region_diversity_met: true,
        provider_diversity_met: true,
        operator_diversity_met: true,
        jurisdiction_diversity_met: true,
        trust_domain_diversity_met: true,
        concentration_limits_met: true,
        trust_minimized_quorum_met: true,
      },
    ]);

    expect(summary).toMatchObject({
      policyEnabled: true,
      minDistinctRelayJurisdictions: 2,
      dominantJurisdictionSharePercent: 50,
      concentrationLimitsMet: true,
      trustMinimizedQuorumMet: true,
    });
  });

  it('parses client proof manifest payload rows', () => {
    const manifest = readGovernanceProposalGuardianRelayClientProofManifest([
      {
        manifest_version: 'guardian_relay_client_proof_v1',
        manifest_hash: 'abc123',
        manifest_payload: {
          generated_at: '2026-04-21T01:00:00.000Z',
        },
        trust_minimized_quorum_met: false,
      },
    ]);

    expect(manifest).toEqual({
      manifestVersion: 'guardian_relay_client_proof_v1',
      manifestHash: 'abc123',
      manifestPayload: {
        generated_at: '2026-04-21T01:00:00.000Z',
      },
      trustMinimizedQuorumMet: false,
    });
  });

  it('parses recent client manifest rows', () => {
    const rows = readGovernanceProposalGuardianRelayRecentClientManifestRows([
      {
        manifest_id: 'manifest-1',
        captured_at: '2026-04-21T01:10:00.000Z',
        manifest_version: 'guardian_relay_client_proof_v1',
        manifest_hash: 'hash-1',
        trust_minimized_quorum_met: true,
        relay_quorum_met: true,
        chain_proof_match_met: false,
        manifest_notes: 'Nightly capture',
      },
    ]);

    expect(rows).toEqual([
      {
        manifestId: 'manifest-1',
        capturedAt: '2026-04-21T01:10:00.000Z',
        manifestVersion: 'guardian_relay_client_proof_v1',
        manifestHash: 'hash-1',
        trustMinimizedQuorumMet: true,
        relayQuorumMet: true,
        chainProofMatchMet: false,
        manifestNotes: 'Nightly capture',
      },
    ]);
  });

  it('detects missing guardian relay backend errors', () => {
    expect(
      isMissingGuardianRelayBackend({
        code: 'PGRST202',
        message: 'Function governance_proposal_guardian_relay_client_proof_manifest does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingGuardianRelayBackend({
        code: '22023',
        message: 'random failure',
      }),
    ).toBe(false);
  });
});
