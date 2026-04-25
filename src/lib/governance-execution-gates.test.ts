import { describe, expect, it } from 'vitest';

import {
  buildFederationExecutionGateMessages,
  buildGuardianRelayExecutionGateMessages,
  isFederationExecutionGateBlocked,
  isGuardianRelayExecutionGateBlocked,
  type GovernanceHubFederationExecutionGate,
  type GovernanceHubGuardianRelayExecutionGate,
} from '@/lib/governance-execution-gates';

const t = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? `:${JSON.stringify(vars)}` : ''}`;

describe('governance-execution-gates', () => {
  it('detects federation and guardian relay blocked states', () => {
    const federationGate: GovernanceHubFederationExecutionGate = {
      policyRequiresFederationDistribution: true,
      distributionGateMet: false,
      federationOps: null,
    };
    const guardianGate: GovernanceHubGuardianRelayExecutionGate = {
      policyRequiresRelayDistribution: true,
      distributionGateMet: true,
      relayOps: {
        policyKey: 'guardian_relay_default',
        requireTrustMinimizedQuorum: true,
        requireRelayOpsReadiness: true,
        maxOpenCriticalRelayAlerts: 0,
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
    };

    expect(isFederationExecutionGateBlocked(federationGate)).toBe(true);
    expect(isGuardianRelayExecutionGateBlocked(guardianGate)).toBe(true);
  });

  it('builds federation gate messages from readiness issues', () => {
    const messages = buildFederationExecutionGateMessages(t, {
      policyRequiresFederationDistribution: true,
      distributionGateMet: false,
      federationOps: {
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
      },
    });

    expect(messages.join(' ')).toContain('governanceHub.federationOpsGateOperators');
    expect(messages.join(' ')).toContain('governanceHub.federationOpsGateWorkerRunNotOk');
  });

  it('builds guardian relay gate messages from readiness issues', () => {
    const messages = buildGuardianRelayExecutionGateMessages(t, {
      policyRequiresRelayDistribution: true,
      distributionGateMet: false,
      relayOps: {
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
        lastWorkerRunStatus: 'failed',
        trustMinimizedQuorumMet: false,
        relayOpsReady: false,
      },
    });

    expect(messages.join(' ')).toContain('governanceHub.guardianRelayOpsGateTrustMinimized');
    expect(messages.join(' ')).toContain('governanceHub.guardianRelayOpsGateWorkerRunNotOk');
  });
});
