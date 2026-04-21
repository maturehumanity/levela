import { describe, expect, it } from 'vitest';

import {
  readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySummary,
  readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
} from '@/lib/governance-public-audit-verifier-federation';

describe('governance-public-audit-verifier-federation helpers', () => {
  it('parses policy ratification summary rows', () => {
    const summary = readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary([
      {
        policy_key: 'default',
        policy_hash: 'policy-hash-1',
        require_policy_ratification: true,
        min_policy_ratification_approvals: 2,
        required_independent_signers: 2,
        approval_count: 3,
        independent_approval_count: 2,
        community_approval_count: 1,
        reject_count: 0,
        ratification_met: true,
        latest_ratified_at: '2026-04-21T05:00:00.000Z',
      },
    ]);

    expect(summary).toEqual({
      policyKey: 'default',
      policyHash: 'policy-hash-1',
      requirePolicyRatification: true,
      minPolicyRatificationApprovals: 2,
      requiredIndependentSigners: 2,
      approvalCount: 3,
      independentApprovalCount: 2,
      communityApprovalCount: 1,
      rejectCount: 0,
      ratificationMet: true,
      latestRatifiedAt: '2026-04-21T05:00:00.000Z',
    });
  });

  it('parses discovery source and discovered candidate board rows', () => {
    const sources = readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows([
      {
        source_id: 'source-1',
        source_key: 'community_registry',
        source_label: 'Community Registry',
        endpoint_url: 'https://registry.example.com',
        discovery_scope: 'public_registry',
        trust_tier: 'community',
        is_active: true,
        last_run_at: '2026-04-21T05:10:00.000Z',
        last_run_status: 'ok',
        candidate_count: 8,
        new_candidate_count: 2,
        promoted_candidate_count: 1,
      },
    ]);

    const candidates = readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows([
      {
        candidate_id: 'candidate-1',
        source_id: 'source-1',
        source_key: 'community_registry',
        source_label: 'Community Registry',
        trust_tier: 'community',
        candidate_key: 'mirror_candidate_1',
        candidate_label: 'Community Mirror 1',
        endpoint_url: 'https://mirror1.example.com',
        region_code: 'EU-CENTRAL',
        operator_label: 'Community Collective',
        trust_domain: 'public',
        candidate_status: 'reviewed',
        discovery_confidence: 88,
        last_seen_at: '2026-04-21T05:12:00.000Z',
      },
    ]);

    expect(sources).toEqual([
      {
        sourceId: 'source-1',
        sourceKey: 'community_registry',
        sourceLabel: 'Community Registry',
        endpointUrl: 'https://registry.example.com',
        discoveryScope: 'public_registry',
        trustTier: 'community',
        isActive: true,
        lastRunAt: '2026-04-21T05:10:00.000Z',
        lastRunStatus: 'ok',
        candidateCount: 8,
        newCandidateCount: 2,
        promotedCandidateCount: 1,
      },
    ]);
    expect(candidates).toEqual([
      {
        candidateId: 'candidate-1',
        sourceId: 'source-1',
        sourceKey: 'community_registry',
        sourceLabel: 'Community Registry',
        trustTier: 'community',
        candidateKey: 'mirror_candidate_1',
        candidateLabel: 'Community Mirror 1',
        endpointUrl: 'https://mirror1.example.com',
        regionCode: 'EU-CENTRAL',
        operatorLabel: 'Community Collective',
        trustDomain: 'public',
        candidateStatus: 'reviewed',
        discoveryConfidence: 88,
        lastSeenAt: '2026-04-21T05:12:00.000Z',
      },
    ]);
  });

  it('parses discovery summary row', () => {
    const summary = readGovernancePublicAuditVerifierMirrorDiscoverySummary([
      {
        batch_id: 'batch-1',
        lookback_hours: 24,
        active_source_count: 4,
        candidate_count: 11,
        new_candidate_count: 3,
        promoted_candidate_count: 2,
        last_run_at: '2026-04-21T05:15:00.000Z',
        last_run_status: 'degraded',
      },
    ]);

    expect(summary).toEqual({
      batchId: 'batch-1',
      lookbackHours: 24,
      activeSourceCount: 4,
      candidateCount: 11,
      newCandidateCount: 3,
      promotedCandidateCount: 2,
      lastRunAt: '2026-04-21T05:15:00.000Z',
      lastRunStatus: 'degraded',
    });
  });
});
