import type { Dispatch, SetStateAction } from 'react';

import { GovernanceHubActivationReadinessCard } from '@/components/governance/GovernanceHubActivationReadinessCard';
import { GovernanceHubIdentityVerificationCard } from '@/components/governance/GovernanceHubIdentityVerificationCard';
import { GovernanceHubProposalSignalsSection } from '@/components/governance/GovernanceHubProposalSignalsSection';
import { GovernanceHubSanctionsSection } from '@/components/governance/GovernanceHubSanctionsSection';
import type { Database } from '@/integrations/supabase/types';
import type {
  GovernanceHubFederationExecutionGate,
  GovernanceHubGuardianRelayExecutionGate,
} from '@/lib/governance-execution-gates';
import type { GovernanceExecutionTaskItem } from '@/lib/governance-execution-tasks';
import type { GovernanceVoteHistoryEntry } from '@/lib/governance-vote-history';
import type { ActivationThresholdReviewHubRow } from '@/lib/governance-activation-review';
import type { GovernanceHubIdentityVerificationPresentation } from '@/lib/verification-workflow';

type GovernanceSanctionRow = Database['public']['Tables']['governance_sanctions']['Row'];
type GovernanceSanctionAppealRow = Database['public']['Tables']['governance_sanction_appeals']['Row'];
type AppealDraftBySanctionId = Record<string, { reason: string; evidence: string }>;

export type GovernanceHubAdditionalDetailsPanelProps = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDateTime: (value: string | null) => string;
  profileId: string | null | undefined;
  backendUnavailable: boolean;
  loadingHub: boolean;
  governanceVoteHistoryEntries: GovernanceVoteHistoryEntry[];
  governanceExecutionTasks: GovernanceExecutionTaskItem[];
  verifierFederationExecutionGate: GovernanceHubFederationExecutionGate | null;
  federationOpsGateMessages: string[];
  guardianRelayExecutionGate: GovernanceHubGuardianRelayExecutionGate | null;
  guardianRelayGateMessages: string[];
  federationDistributionEscalationOpenPageCount: number;
  activationDemographicFeedEscalationOpenPageCount: number;
  guardianRelayEscalationOpenPageCount: number;
  emergencyAccessOpsEscalationOpenPageCount: number;
  identityVerificationPresentation: GovernanceHubIdentityVerificationPresentation | null;
  identityVerificationLoading: boolean;
  identityVerificationUnavailable: boolean;
  identityVerificationLoadFailed: boolean;
  citizenActivationReviews: ActivationThresholdReviewHubRow[];
  activationHubLoading: boolean;
  activationHubUnavailable: boolean;
  activationHubLoadFailed: boolean;
  sanctionsBackendUnavailable: boolean;
  activeSanctions: GovernanceSanctionRow[];
  openAppealsBySanctionId: Record<string, GovernanceSanctionAppealRow>;
  appealDraftBySanctionId: AppealDraftBySanctionId;
  setAppealDraftBySanctionId: Dispatch<SetStateAction<AppealDraftBySanctionId>>;
  submittingAppealForSanctionId: string | null;
  onSubmitAppeal: (sanction: GovernanceSanctionRow) => Promise<void>;
  appeals: GovernanceSanctionAppealRow[];
};

export function GovernanceHubAdditionalDetailsPanel({
  t,
  formatDateTime,
  profileId,
  backendUnavailable,
  loadingHub,
  governanceVoteHistoryEntries,
  governanceExecutionTasks,
  verifierFederationExecutionGate,
  federationOpsGateMessages,
  guardianRelayExecutionGate,
  guardianRelayGateMessages,
  federationDistributionEscalationOpenPageCount,
  activationDemographicFeedEscalationOpenPageCount,
  guardianRelayEscalationOpenPageCount,
  emergencyAccessOpsEscalationOpenPageCount,
  identityVerificationPresentation,
  identityVerificationLoading,
  identityVerificationUnavailable,
  identityVerificationLoadFailed,
  citizenActivationReviews,
  activationHubLoading,
  activationHubUnavailable,
  activationHubLoadFailed,
  sanctionsBackendUnavailable,
  activeSanctions,
  openAppealsBySanctionId,
  appealDraftBySanctionId,
  setAppealDraftBySanctionId,
  submittingAppealForSanctionId,
  onSubmitAppeal,
  appeals,
}: GovernanceHubAdditionalDetailsPanelProps) {
  return (
    <details className="rounded-3xl border border-border/60 p-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Additional governance details</summary>
      <div className="mt-4 space-y-4">
        <GovernanceHubProposalSignalsSection
          t={t}
          formatDateTime={formatDateTime}
          profileId={profileId}
          backendUnavailable={backendUnavailable}
          loadingHub={loadingHub}
          governanceVoteHistoryEntries={governanceVoteHistoryEntries}
          governanceExecutionTasks={governanceExecutionTasks}
          verifierFederationExecutionGate={verifierFederationExecutionGate}
          federationOpsGateMessages={federationOpsGateMessages}
          guardianRelayExecutionGate={guardianRelayExecutionGate}
          guardianRelayGateMessages={guardianRelayGateMessages}
          federationDistributionEscalationOpenPageCount={federationDistributionEscalationOpenPageCount}
          activationDemographicFeedEscalationOpenPageCount={activationDemographicFeedEscalationOpenPageCount}
          guardianRelayEscalationOpenPageCount={guardianRelayEscalationOpenPageCount}
          emergencyAccessOpsEscalationOpenPageCount={emergencyAccessOpsEscalationOpenPageCount}
        />
        {profileId ? (
          <GovernanceHubIdentityVerificationCard
            motionDelaySec={0}
            t={t}
            identityVerificationPresentation={identityVerificationPresentation}
            identityVerificationLoading={identityVerificationLoading}
            identityVerificationUnavailable={identityVerificationUnavailable}
            identityVerificationLoadFailed={identityVerificationLoadFailed}
          />
        ) : null}
        {profileId ? (
          <GovernanceHubActivationReadinessCard
            motionDelaySec={0}
            t={t}
            formatDateTime={formatDateTime}
            citizenActivationReviews={citizenActivationReviews}
            activationHubLoading={activationHubLoading}
            activationHubUnavailable={activationHubUnavailable}
            activationHubLoadFailed={activationHubLoadFailed}
          />
        ) : null}
        <GovernanceHubSanctionsSection
          t={t}
          formatDateTime={formatDateTime}
          sanctionsBackendUnavailable={sanctionsBackendUnavailable}
          activeSanctions={activeSanctions}
          openAppealsBySanctionId={openAppealsBySanctionId}
          appealDraftBySanctionId={appealDraftBySanctionId}
          setAppealDraftBySanctionId={setAppealDraftBySanctionId}
          submittingAppealForSanctionId={submittingAppealForSanctionId}
          onSubmitAppeal={onSubmitAppeal}
          appeals={appeals}
        />
      </div>
    </details>
  );
}
