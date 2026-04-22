import { describe, expect, it } from 'vitest';

import {
  readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySummary,
  readGovernancePublicAuditVerifierMirrorFederationAlertBoardRows,
  readGovernancePublicAuditVerifierMirrorFederationOnboardingBoardRows,
  readGovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  readGovernancePublicAuditVerifierMirrorSignerGovernanceBoardRows,
  readGovernancePublicAuditVerifierMirrorSignerGovernanceSummary,
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

  it('parses signer governance summary and board rows', () => {
    const summary = readGovernancePublicAuditVerifierMirrorSignerGovernanceSummary([
      {
        policy_key: 'default',
        require_signer_governance_approval: true,
        min_signer_governance_independent_approvals: 2,
        approved_signer_count: 3,
        approved_independent_signer_count: 2,
        pending_signer_count: 1,
        rejected_signer_count: 0,
        suspended_signer_count: 0,
        governance_ready: true,
        latest_attested_at: '2026-04-21T05:20:00.000Z',
      },
    ]);

    const board = readGovernancePublicAuditVerifierMirrorSignerGovernanceBoardRows([
      {
        signer_id: 'signer-1',
        signer_key: 'independent_signer_1',
        signer_label: 'Independent Signer 1',
        trust_tier: 'independent',
        is_active: true,
        governance_status: 'pending',
        required_independent_approvals: 2,
        approval_count: 2,
        independent_approval_count: 2,
        community_approval_count: 0,
        reject_count: 0,
        governance_met: true,
        latest_attested_at: '2026-04-21T05:18:00.000Z',
        governance_last_reviewed_at: '2026-04-21T05:19:00.000Z',
      },
    ]);

    expect(summary).toEqual({
      policyKey: 'default',
      requireSignerGovernanceApproval: true,
      minSignerGovernanceIndependentApprovals: 2,
      approvedSignerCount: 3,
      approvedIndependentSignerCount: 2,
      pendingSignerCount: 1,
      rejectedSignerCount: 0,
      suspendedSignerCount: 0,
      governanceReady: true,
      latestAttestedAt: '2026-04-21T05:20:00.000Z',
    });
    expect(board).toEqual([
      {
        signerId: 'signer-1',
        signerKey: 'independent_signer_1',
        signerLabel: 'Independent Signer 1',
        trustTier: 'independent',
        isActive: true,
        governanceStatus: 'pending',
        requiredIndependentApprovals: 2,
        approvalCount: 2,
        independentApprovalCount: 2,
        communityApprovalCount: 0,
        rejectCount: 0,
        governanceMet: true,
        latestAttestedAt: '2026-04-21T05:18:00.000Z',
        governanceLastReviewedAt: '2026-04-21T05:19:00.000Z',
      },
    ]);
  });

  it('parses federation onboarding and alert board rows', () => {
    const onboardingRows = readGovernancePublicAuditVerifierMirrorFederationOnboardingBoardRows([
      {
        request_id: 'request-1',
        operator_id: 'operator-1',
        operator_key: 'operator_key_1',
        operator_label: 'Operator 1',
        operator_onboarding_status: 'approved',
        request_status: 'approved',
        requested_mirror_key: 'mirror_key_1',
        requested_mirror_label: 'Mirror 1',
        requested_endpoint_url: 'https://mirror1.example.com',
        requested_region_code: 'US-WEST',
        requested_trust_domain: 'public',
        onboarded_mirror_id: null,
        reviewed_at: '2026-04-21T05:25:00.000Z',
        created_at: '2026-04-21T05:24:00.000Z',
      },
    ]);
    const alertRows = readGovernancePublicAuditVerifierMirrorFederationAlertBoardRows([
      {
        alert_id: 'alert-1',
        alert_key: 'federation-alert-1',
        severity: 'critical',
        alert_scope: 'operator_health_audit',
        alert_status: 'open',
        alert_message: 'Operator heartbeat missing',
        opened_at: '2026-04-21T05:26:00.000Z',
        resolved_at: null,
      },
    ]);

    expect(onboardingRows).toEqual([
      {
        requestId: 'request-1',
        operatorId: 'operator-1',
        operatorKey: 'operator_key_1',
        operatorLabel: 'Operator 1',
        operatorOnboardingStatus: 'approved',
        requestStatus: 'approved',
        requestedMirrorKey: 'mirror_key_1',
        requestedMirrorLabel: 'Mirror 1',
        requestedEndpointUrl: 'https://mirror1.example.com',
        requestedRegionCode: 'US-WEST',
        requestedTrustDomain: 'public',
        onboardedMirrorId: null,
        reviewedAt: '2026-04-21T05:25:00.000Z',
        createdAt: '2026-04-21T05:24:00.000Z',
      },
    ]);
    expect(alertRows).toEqual([
      {
        alertId: 'alert-1',
        alertKey: 'federation-alert-1',
        severity: 'critical',
        alertScope: 'operator_health_audit',
        alertStatus: 'open',
        alertMessage: 'Operator heartbeat missing',
        openedAt: '2026-04-21T05:26:00.000Z',
        resolvedAt: null,
      },
    ]);
  });

  it('parses federation operations summary rows', () => {
    const summary = readGovernancePublicAuditVerifierMirrorFederationOperationsSummary([
      {
        policy_key: 'default',
        require_federation_ops_readiness: true,
        max_open_critical_federation_alerts: 1,
        min_onboarded_federation_operators: 2,
        registered_operator_count: 3,
        approved_operator_count: 2,
        onboarded_operator_count: 2,
        pending_request_count: 1,
        approved_request_count: 1,
        onboarded_request_count: 2,
        open_warning_alert_count: 1,
        open_critical_alert_count: 0,
        alert_sla_hours: 12,
        alert_sla_breached_count: 0,
        last_worker_run_at: '2026-04-21T05:30:00.000Z',
        last_worker_run_status: 'ok',
        distribution_verification_lookback_hours: 24,
        last_distribution_verification_run_at: '2026-04-21T05:29:00.000Z',
        last_distribution_verification_run_status: 'ok',
        distribution_verification_stale: false,
        open_distribution_stale_package_alert_count: 0,
        open_distribution_bad_signature_alert_count: 0,
        open_distribution_policy_mismatch_alert_count: 0,
        open_distribution_verification_alert_count: 0,
        federation_ops_ready: true,
      },
    ]);

    expect(summary).toEqual({
      policyKey: 'default',
      requireFederationOpsReadiness: true,
      maxOpenCriticalFederationAlerts: 1,
      minOnboardedFederationOperators: 2,
      registeredOperatorCount: 3,
      approvedOperatorCount: 2,
      onboardedOperatorCount: 2,
      pendingRequestCount: 1,
      approvedRequestCount: 1,
      onboardedRequestCount: 2,
      openWarningAlertCount: 1,
      openCriticalAlertCount: 0,
      alertSlaHours: 12,
      alertSlaBreachedCount: 0,
      lastWorkerRunAt: '2026-04-21T05:30:00.000Z',
      lastWorkerRunStatus: 'ok',
      distributionVerificationLookbackHours: 24,
      lastDistributionVerificationRunAt: '2026-04-21T05:29:00.000Z',
      lastDistributionVerificationRunStatus: 'ok',
      distributionVerificationStale: false,
      openDistributionStalePackageAlertCount: 0,
      openDistributionBadSignatureAlertCount: 0,
      openDistributionPolicyMismatchAlertCount: 0,
      openDistributionVerificationAlertCount: 0,
      federationOpsReady: true,
    });
  });
});
