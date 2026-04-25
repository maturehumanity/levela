import type { GovernanceProposalGuardianRelayOperationsSummary } from '@/lib/governance-guardian-relays';
import { readGovernanceGuardianRelayOpsReadinessIssues } from '@/lib/governance-guardian-relay-distribution';
import type { GovernancePublicAuditVerifierMirrorFederationOperationsSummary } from '@/lib/governance-public-audit-verifiers';
import { readGovernancePublicAuditVerifierFederationOpsReadinessIssues } from '@/lib/governance-public-audit-verifiers';

export type GovernanceHubFederationExecutionGate = {
  policyRequiresFederationDistribution: boolean;
  distributionGateMet: boolean;
  federationOps: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
};

export type GovernanceHubGuardianRelayExecutionGate = {
  policyRequiresRelayDistribution: boolean;
  distributionGateMet: boolean;
  relayOps: GovernanceProposalGuardianRelayOperationsSummary | null;
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function isFederationExecutionGateBlocked(gate: GovernanceHubFederationExecutionGate | null) {
  if (!gate?.policyRequiresFederationDistribution) return false;
  return !gate.distributionGateMet || (gate.federationOps !== null && !gate.federationOps.federationOpsReady);
}

export function isGuardianRelayExecutionGateBlocked(gate: GovernanceHubGuardianRelayExecutionGate | null) {
  if (!gate?.policyRequiresRelayDistribution) return false;
  return !gate.distributionGateMet || (gate.relayOps !== null && !gate.relayOps.relayOpsReady);
}

export function buildFederationExecutionGateMessages(t: Translate, gate: GovernanceHubFederationExecutionGate | null): string[] {
  const ops = gate?.federationOps;
  if (!ops || ops.federationOpsReady) return [];

  return readGovernancePublicAuditVerifierFederationOpsReadinessIssues(ops)
    .map((issue) => {
      switch (issue) {
        case 'operators_below_minimum':
          return t('governanceHub.federationOpsGateOperators', {
            have: ops.onboardedOperatorCount,
            need: ops.minOnboardedFederationOperators,
          });
        case 'critical_alert_budget_exceeded':
          return t('governanceHub.federationOpsGateCriticalAlerts', {
            open: ops.openCriticalAlertCount,
            max: ops.maxOpenCriticalFederationAlerts,
          });
        case 'alert_sla_breaches_open':
          return t('governanceHub.federationOpsGateSlaBreaches');
        case 'distribution_verification_stale':
          return t('governanceHub.federationOpsGateStaleVerification');
        case 'distribution_verification_alerts_open':
          return t('governanceHub.federationOpsGateDistributionAlerts', {
            count: ops.openDistributionVerificationAlertCount,
          });
        case 'worker_run_not_ok':
          return t('governanceHub.federationOpsGateWorkerRunNotOk', { status: ops.lastWorkerRunStatus });
        case 'federation_ops_not_ready':
        default:
          return null;
      }
    })
    .filter((message): message is string => Boolean(message));
}

export function buildGuardianRelayExecutionGateMessages(t: Translate, gate: GovernanceHubGuardianRelayExecutionGate | null): string[] {
  const relayOps = gate?.relayOps;
  if (!relayOps || relayOps.relayOpsReady) return [];

  const messages: string[] = [];
  for (const issue of readGovernanceGuardianRelayOpsReadinessIssues(relayOps)) {
    switch (issue) {
      case 'trust_minimized_quorum_not_met':
        messages.push(t('governanceHub.guardianRelayOpsGateTrustMinimized'));
        break;
      case 'critical_alert_budget_exceeded':
        messages.push(t('governanceHub.guardianRelayOpsGateCriticalAlerts', {
          open: relayOps.openCriticalAlertCount,
          max: relayOps.maxOpenCriticalRelayAlerts,
        }));
        break;
      case 'stale_signers_present':
        messages.push(t('governanceHub.guardianRelayOpsGateStaleSigners', { count: relayOps.staleSignerCount }));
        break;
      case 'worker_run_not_ok':
        messages.push(t('governanceHub.guardianRelayOpsGateWorkerRunNotOk', { status: relayOps.lastWorkerRunStatus }));
        break;
      case 'relay_ops_not_ready':
      default:
        break;
    }
  }
  return messages;
}
