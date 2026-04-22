import type { Database } from '@/integrations/supabase/types';

export type GuardianRelayPolicyRow = Database['public']['Tables']['governance_guardian_relay_policies']['Row'];
export type GuardianRelayNodeRow = Database['public']['Tables']['governance_guardian_relay_nodes']['Row'];
export type GuardianRelayAttestationRow = Database['public']['Tables']['governance_proposal_guardian_relay_attestations']['Row'];

export interface GovernanceProposalGuardianRelaySummary {
  policyEnabled: boolean;
  requiredRelayAttestations: number;
  requireChainProofMatch: boolean;
  activeRelayCount: number;
  relayVerifiedCount: number;
  relayMismatchCount: number;
  relayUnreachableCount: number;
  signersWithRelayQuorumCount: number;
  signersWithChainProofCount: number;
  externalApprovalCount: number;
  relayQuorumMet: boolean;
  chainProofMatchMet: boolean;
}

export interface GovernanceProposalGuardianRelayDiversityAudit {
  policyEnabled: boolean;
  requiredRelayAttestations: number;
  minDistinctRelayRegions: number;
  minDistinctRelayProviders: number;
  minDistinctRelayOperators: number;
  verifiedRelayCount: number;
  distinctRegionsCount: number;
  distinctProvidersCount: number;
  distinctOperatorsCount: number;
  dominantRegionSharePercent: number | null;
  dominantProviderSharePercent: number | null;
  dominantOperatorSharePercent: number | null;
  regionDiversityMet: boolean;
  providerDiversityMet: boolean;
  operatorDiversityMet: boolean;
  overallDiversityMet: boolean;
}

export interface GovernanceProposalGuardianRelayAttestationAuditRow {
  relayId: string;
  relayKey: string;
  relayLabel: string | null;
  relayRegionCode: string;
  relayInfrastructureProvider: string;
  relayOperatorLabel: string;
  relayTrustDomain: string;
  totalAttestationCount: number;
  verifiedCount: number;
  mismatchCount: number;
  unreachableCount: number;
  lastAttestedAt: string | null;
  recentAttestationCount: number;
  recentFailureCount: number;
  recentHealthScore: number | null;
  recentHealthStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
}

export interface GovernanceProposalGuardianRelayRecentAuditRow {
  reportId: string;
  capturedAt: string;
  overallDiversityMet: boolean;
  relayQuorumMet: boolean;
  chainProofMatchMet: boolean;
  verifiedRelayCount: number;
  distinctRegionsCount: number;
  distinctProvidersCount: number;
  distinctOperatorsCount: number;
  auditNotes: string | null;
}

export interface GovernanceProposalGuardianRelayTrustMinimizedSummary {
  policyEnabled: boolean;
  requiredRelayAttestations: number;
  minDistinctRelayRegions: number;
  minDistinctRelayProviders: number;
  minDistinctRelayOperators: number;
  minDistinctRelayJurisdictions: number;
  minDistinctRelayTrustDomains: number;
  maxDominantRelayRegionSharePercent: number;
  maxDominantRelayProviderSharePercent: number;
  maxDominantRelayOperatorSharePercent: number;
  maxDominantRelayJurisdictionSharePercent: number;
  maxDominantRelayTrustDomainSharePercent: number;
  externalApprovalCount: number;
  signersWithRelayQuorumCount: number;
  signersWithChainProofCount: number;
  verifiedRelayCount: number;
  distinctRegionsCount: number;
  distinctProvidersCount: number;
  distinctOperatorsCount: number;
  distinctJurisdictionsCount: number;
  distinctTrustDomainsCount: number;
  dominantRegionSharePercent: number | null;
  dominantProviderSharePercent: number | null;
  dominantOperatorSharePercent: number | null;
  dominantJurisdictionSharePercent: number | null;
  dominantTrustDomainSharePercent: number | null;
  relayQuorumMet: boolean;
  chainProofMatchMet: boolean;
  regionDiversityMet: boolean;
  providerDiversityMet: boolean;
  operatorDiversityMet: boolean;
  jurisdictionDiversityMet: boolean;
  trustDomainDiversityMet: boolean;
  concentrationLimitsMet: boolean;
  trustMinimizedQuorumMet: boolean;
}

export interface GovernanceProposalGuardianRelayOperationsSummary {
  policyKey: string;
  requireTrustMinimizedQuorum: boolean;
  requireRelayOpsReadiness: boolean;
  maxOpenCriticalRelayAlerts: number;
  relayAttestationSlaMinutes: number;
  externalApprovalCount: number;
  staleSignerCount: number;
  openWarningAlertCount: number;
  openCriticalAlertCount: number;
  lastWorkerRunAt: string | null;
  lastWorkerRunStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  trustMinimizedQuorumMet: boolean;
  relayOpsReady: boolean;
}

export interface GovernanceProposalGuardianRelayClientProofManifest {
  manifestVersion: string;
  manifestHash: string;
  manifestPayload: Record<string, unknown>;
  trustMinimizedQuorumMet: boolean;
  relayOpsReady: boolean;
}

export interface GovernanceProposalGuardianRelayAlertBoardRow {
  alertId: string;
  alertKey: string;
  severity: 'info' | 'warning' | 'critical' | 'unknown';
  alertScope: string;
  alertStatus: 'open' | 'acknowledged' | 'resolved' | 'unknown';
  alertMessage: string;
  openedAt: string | null;
  resolvedAt: string | null;
}

export interface GovernanceProposalGuardianRelayWorkerRunBoardRow {
  runId: string;
  runScope: 'attestation_sweep' | 'diversity_audit' | 'manifest_capture' | 'manual' | 'unknown';
  runStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  processedSignerCount: number;
  staleSignerCount: number;
  openAlertCount: number;
  errorMessage: string | null;
  observedAt: string | null;
}

export interface GovernanceProposalGuardianRelayRecentClientManifestRow {
  manifestId: string;
  capturedAt: string;
  manifestVersion: string;
  manifestHash: string;
  trustMinimizedQuorumMet: boolean;
  relayQuorumMet: boolean;
  chainProofMatchMet: boolean;
  manifestNotes: string | null;
}
