import { Link } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import type {
  GovernanceHubFederationExecutionGate,
  GovernanceHubGuardianRelayExecutionGate,
} from '@/lib/governance-execution-gates';
import {
  isFederationExecutionGateBlocked,
  isGuardianRelayExecutionGateBlocked,
} from '@/lib/governance-execution-gates';

export type GovernanceHubExecutionGateBannersProps = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  federationGate: GovernanceHubFederationExecutionGate | null;
  federationMessages: string[];
  guardianRelayGate: GovernanceHubGuardianRelayExecutionGate | null;
  guardianRelayMessages: string[];
};

export function GovernanceHubExecutionGateBanners({
  t,
  federationGate,
  federationMessages,
  guardianRelayGate,
  guardianRelayMessages,
}: GovernanceHubExecutionGateBannersProps) {
  return (
    <>
      {isFederationExecutionGateBlocked(federationGate) && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4 text-sm shadow-sm">
          <p className="font-medium text-foreground">{t('governanceHub.federationExecutionGateBannerTitle')}</p>
          {!federationGate?.distributionGateMet && (
            <p className="mt-2 text-muted-foreground">{t('governanceHub.federationDistributionGateBannerBody')}</p>
          )}
          {federationGate?.federationOps !== null && !federationGate.federationOps.federationOpsReady && (
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>{t('governanceHub.federationOpsGateIntro')}</p>
              {federationMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
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

      {isGuardianRelayExecutionGateBlocked(guardianRelayGate) && (
        <Card className="rounded-2xl border-sky-500/30 bg-sky-500/5 p-4 text-sm shadow-sm">
          <p className="font-medium text-foreground">{t('governanceHub.guardianRelayExecutionGateBannerTitle')}</p>
          {!guardianRelayGate?.distributionGateMet && (
            <p className="mt-2 text-muted-foreground">{t('governanceHub.guardianRelayDistributionGateBannerBody')}</p>
          )}
          {guardianRelayGate?.relayOps !== null && !guardianRelayGate.relayOps.relayOpsReady && (
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>{t('governanceHub.guardianRelayOpsGateIntro')}</p>
              {guardianRelayMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
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
    </>
  );
}
