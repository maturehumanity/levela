import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { GovernanceHubExecutionGateBanners } from '@/components/governance/GovernanceHubExecutionGateBanners';
import { GovernanceHubExecutionTasksCard } from '@/components/governance/GovernanceHubExecutionTasksCard';
import { GovernanceHubVoteHistoryCard } from '@/components/governance/GovernanceHubVoteHistoryCard';
import type {
  GovernanceHubFederationExecutionGate,
  GovernanceHubGuardianRelayExecutionGate,
} from '@/lib/governance-execution-gates';
import type { GovernanceExecutionTaskItem } from '@/lib/governance-execution-tasks';
import type { GovernanceVoteHistoryEntry } from '@/lib/governance-vote-history';

export type GovernanceHubProposalSignalsSectionProps = {
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
};

export function GovernanceHubProposalSignalsSection({
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
}: GovernanceHubProposalSignalsSectionProps) {
  return (
    <>
      {profileId && !backendUnavailable && !loadingHub ? (
        <GovernanceHubVoteHistoryCard t={t} formatDateTime={formatDateTime} entries={governanceVoteHistoryEntries} />
      ) : null}

      {profileId && !backendUnavailable && !loadingHub ? (
        <GovernanceHubExecutionTasksCard t={t} formatDateTime={formatDateTime} tasks={governanceExecutionTasks} />
      ) : null}

      <GovernanceHubExecutionGateBanners
        t={t}
        federationGate={verifierFederationExecutionGate}
        federationMessages={federationOpsGateMessages}
        guardianRelayGate={guardianRelayExecutionGate}
        guardianRelayMessages={guardianRelayGateMessages}
      />

      {federationDistributionEscalationOpenPageCount > 0 && (
        <Card className="rounded-2xl border-orange-500/30 bg-orange-500/5 p-4 text-sm shadow-sm">
          <p className="font-medium text-foreground">{t('governanceHub.federationDistributionEscalationBannerTitle')}</p>
          <p className="mt-2 text-muted-foreground">
            {t('governanceHub.federationDistributionEscalationBannerBody', {
              count: federationDistributionEscalationOpenPageCount,
            })}
          </p>
          <p className="mt-3 text-sm">
            <Link
              to="/settings/admin/governance#stewardship-public-audit-tools"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('governanceHub.governanceStewardshipToolsLink')}
            </Link>
          </p>
        </Card>
      )}

      {activationDemographicFeedEscalationOpenPageCount > 0 && (
        <Card className="rounded-2xl border-teal-500/30 bg-teal-500/5 p-4 text-sm shadow-sm">
          <p className="font-medium text-foreground">{t('governanceHub.activationDemographicFeedEscalationBannerTitle')}</p>
          <p className="mt-2 text-muted-foreground">
            {t('governanceHub.activationDemographicFeedEscalationBannerBody', {
              count: activationDemographicFeedEscalationOpenPageCount,
            })}
          </p>
          <p className="mt-3 text-sm">
            <Link
              to="/settings/admin/governance#stewardship-activation-review"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('governanceHub.governanceActivationStewardshipLink')}
            </Link>
          </p>
        </Card>
      )}

      {guardianRelayEscalationOpenPageCount > 0 && (
        <Card className="rounded-2xl border-sky-500/30 bg-sky-500/5 p-4 text-sm shadow-sm">
          <p className="font-medium text-foreground">{t('governanceHub.guardianRelayEscalationBannerTitle')}</p>
          <p className="mt-2 text-muted-foreground">
            {t('governanceHub.guardianRelayEscalationBannerBody', { count: guardianRelayEscalationOpenPageCount })}
          </p>
          <p className="mt-3 text-sm">
            <Link
              to="/settings/admin/governance#stewardship-public-audit-tools"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('governanceHub.governanceStewardshipToolsLink')}
            </Link>
          </p>
        </Card>
      )}

      {emergencyAccessOpsEscalationOpenPageCount > 0 && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4 text-sm shadow-sm">
          <p className="font-medium text-foreground">{t('governanceHub.emergencyAccessOpsEscalationBannerTitle')}</p>
          <p className="mt-2 text-muted-foreground">
            {t('governanceHub.emergencyAccessOpsEscalationBannerBody', { count: emergencyAccessOpsEscalationOpenPageCount })}
          </p>
          <p className="mt-3 text-sm">
            <Link
              to="/settings/admin/users"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('governanceHub.governanceEmergencyAccessStewardshipLink')}
            </Link>
          </p>
        </Card>
      )}
    </>
  );
}
