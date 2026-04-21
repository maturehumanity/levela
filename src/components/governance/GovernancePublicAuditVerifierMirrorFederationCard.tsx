import { Badge } from '@/components/ui/badge';
import { GovernancePublicAuditVerifierMirrorFederationControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationControls';
import type {
  GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySummary,
  GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationCardProps {
  canManageMirrorFederation: boolean;
  registeringDiscoverySource: boolean;
  recordingDiscoveryRun: boolean;
  upsertingDiscoveredCandidate: boolean;
  promotingDiscoveredCandidate: boolean;
  savingPolicyRatification: boolean;
  policyRatificationSummary: GovernancePublicAuditVerifierMirrorPolicyRatificationSummary | null;
  discoverySummary: GovernancePublicAuditVerifierMirrorDiscoverySummary | null;
  discoverySources: GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[];
  discoveredCandidates: GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[];
  formatTimestamp: (value: string | null) => string;
  registerDiscoverySource: (draft: {
    sourceKey: string;
    sourceLabel: string;
    endpointUrl: string;
    discoveryScope: string;
    trustTier: string;
  }) => Promise<void> | void;
  recordDiscoveryRun: (draft: {
    sourceId: string;
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredCount: string;
    acceptedCandidateCount: string;
    staleCandidateCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  upsertDiscoveredCandidate: (draft: {
    sourceId: string;
    candidateKey: string;
    candidateLabel: string;
    endpointUrl: string;
    mirrorType: string;
    regionCode: string;
    jurisdictionCountryCode: string;
    operatorLabel: string;
    trustDomain: string;
    discoveryConfidence: string;
    candidateStatus: 'new' | 'reviewed' | 'promoted' | 'rejected' | 'inactive';
  }) => Promise<void> | void;
  promoteDiscoveredCandidate: (candidateId: string) => Promise<void> | void;
  recordPolicyRatification: (draft: {
    policyKey: string;
    signerKey: string;
    ratificationDecision: 'approve' | 'reject';
    ratificationSignature: string;
  }) => Promise<void> | void;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function GovernancePublicAuditVerifierMirrorFederationCard({
  canManageMirrorFederation,
  registeringDiscoverySource,
  recordingDiscoveryRun,
  upsertingDiscoveredCandidate,
  promotingDiscoveredCandidate,
  savingPolicyRatification,
  policyRatificationSummary,
  discoverySummary,
  discoverySources,
  discoveredCandidates,
  formatTimestamp,
  registerDiscoverySource,
  recordDiscoveryRun,
  upsertDiscoveredCandidate,
  promoteDiscoveredCandidate,
  recordPolicyRatification,
}: GovernancePublicAuditVerifierMirrorFederationCardProps) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
      <p className="font-medium text-foreground">Mirror federation</p>
      <div className="flex flex-wrap gap-2">
        {policyRatificationSummary && (
          <Badge
            variant="outline"
            className={policyRatificationSummary.ratificationMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Policy ratification {policyRatificationSummary.ratificationMet ? 'met' : 'pending'}
          </Badge>
        )}
        {discoverySummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Candidates {discoverySummary.candidateCount}
          </Badge>
        )}
        {discoverySummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Sources {discoverySummary.activeSourceCount}
          </Badge>
        )}
      </div>

      <GovernancePublicAuditVerifierMirrorFederationControls
        canManageMirrorFederation={canManageMirrorFederation}
        registeringDiscoverySource={registeringDiscoverySource}
        recordingDiscoveryRun={recordingDiscoveryRun}
        upsertingDiscoveredCandidate={upsertingDiscoveredCandidate}
        promotingDiscoveredCandidate={promotingDiscoveredCandidate}
        savingPolicyRatification={savingPolicyRatification}
        discoverySources={discoverySources}
        discoveredCandidates={discoveredCandidates}
        registerDiscoverySource={registerDiscoverySource}
        recordDiscoveryRun={recordDiscoveryRun}
        upsertDiscoveredCandidate={upsertDiscoveredCandidate}
        promoteDiscoveredCandidate={promoteDiscoveredCandidate}
        recordPolicyRatification={recordPolicyRatification}
      />

      {policyRatificationSummary && (
        <p className="text-muted-foreground">
          {previewHash(policyRatificationSummary.policyHash)} • approvals {policyRatificationSummary.independentApprovalCount}/{policyRatificationSummary.minPolicyRatificationApprovals} independent
        </p>
      )}
      {discoverySummary && (
        <p className="text-muted-foreground">
          New {discoverySummary.newCandidateCount} • Promoted {discoverySummary.promotedCandidateCount} • Last run {formatTimestamp(discoverySummary.lastRunAt)}
        </p>
      )}
      <div className="space-y-1 text-muted-foreground">
        {discoverySources.slice(0, 3).map((source) => (
          <p key={source.sourceId}>
            {source.sourceLabel || source.sourceKey} • {source.lastRunStatus} • candidates {source.candidateCount}
          </p>
        ))}
      </div>
      <div className="space-y-1 text-muted-foreground">
        {discoveredCandidates.slice(0, 3).map((candidate) => (
          <p key={candidate.candidateId}>
            {candidate.candidateLabel || candidate.candidateKey} • {candidate.candidateStatus} • {candidate.discoveryConfidence}
          </p>
        ))}
      </div>
    </div>
  );
}
