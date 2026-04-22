import { useMemo } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GovernanceGuardianRelayAuditSection } from '@/components/governance/GovernanceGuardianRelayAuditSection';
import { GovernanceGuardianRelayNodeAndAttestationControls } from '@/components/governance/GovernanceGuardianRelayNodeAndAttestationControls';
import { GovernanceGuardianRelayOpsControls } from '@/components/governance/GovernanceGuardianRelayOpsControls';
import { GovernanceGuardianRelayProofSection } from '@/components/governance/GovernanceGuardianRelayProofSection';
import type { GuardianExternalSignerRow } from '@/lib/governance-guardian-multisig';
import { useGovernanceGuardianRelays } from '@/lib/use-governance-guardian-relays';
interface GovernanceGuardianRelayPanelProps {
  proposalId: string;
  externalSigners: GuardianExternalSignerRow[];
}

function formatTimestamp(value: string | null) {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString();
}

export function GovernanceGuardianRelayPanel({
  proposalId,
  externalSigners,
}: GovernanceGuardianRelayPanelProps) {
  const {
    loadingRelayData,
    relayBackendUnavailable,
    canManageGuardianRelays,
    registeringRelayNode,
    recordingRelayAttestation,
    capturingRelayAuditReport,
    capturingRelayClientManifest,
    capturingRelayClientVerificationPackage,
    savingRelayOpsRequirement,
    recordingRelayWorkerRun,
    openingRelayAlert,
    resolvingRelayAlert,
    escalatingCriticalRelayPublicExecution,
    syncingRelaySlaAlerts,
    signingRelayClientVerificationPackage,
    togglingRelayNodeId,
    relayPolicy,
    relayNodes,
    relayAttestations,
    relaySummary,
    relayTrustMinimizedSummary,
    relayOperationsSummary,
    relayClientProofManifest,
    relayDiversityAudit,
    relayAttestationAuditRows,
    relayRecentAuditReports,
    relayRecentClientManifests,
    relayClientVerificationPackage,
    relayRecentClientVerificationPackages,
    relayClientVerificationDistributionSummary,
    relayClientVerificationSignatures,
    relayAlertBoardRows,
    relayWorkerRunBoardRows,
    loadRelayData,
    registerRelayNode,
    setRelayNodeActive,
    recordRelayAttestation,
    captureRelayAuditReport,
    captureRelayClientManifest,
    captureRelayClientVerificationPackage,
    saveRelayOpsRequirement,
    recordRelayWorkerRun,
    openRelayAlert,
    resolveRelayAlert,
    escalateOpenCriticalRelayAlertsToPublicExecution,
    syncRelayAttestationSlaAlerts,
    signRelayClientVerificationPackage,
  } = useGovernanceGuardianRelays({ proposalId });

  if (relayBackendUnavailable) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border/50 bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Relay quorum + chain proofs</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loadingRelayData}
          onClick={() => void loadRelayData()}
        >
          {loadingRelayData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh relays
        </Button>
      </div>

      {relaySummary && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={relaySummary.relayQuorumMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Relay quorum {relaySummary.relayQuorumMet ? 'met' : 'pending'}
          </Badge>
          {relaySummary.requireChainProofMatch && (
            <Badge
              variant="outline"
              className={relaySummary.chainProofMatchMet
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Chain proofs {relaySummary.chainProofMatchMet ? 'matched' : 'pending'}
            </Badge>
          )}
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Signers w/ quorum {relaySummary.signersWithRelayQuorumCount}/{relaySummary.externalApprovalCount}
          </Badge>
          {relayPolicy && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Required relays {relayPolicy.required_relay_attestations}
            </Badge>
          )}
          {relayOperationsSummary && (
            <Badge
              variant="outline"
              className={relayOperationsSummary.relayOpsReady
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Relay ops {relayOperationsSummary.relayOpsReady ? 'ready' : 'pending'}
            </Badge>
          )}
        </div>
      )}

      {relayDiversityAudit && (
        <div className="space-y-1 rounded-lg border border-border/60 bg-card p-2 text-xs">
          <p className="font-medium text-foreground">Relay diversity audit</p>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={relayDiversityAudit.overallDiversityMet
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Diversity {relayDiversityAudit.overallDiversityMet ? 'met' : 'pending'}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Regions {relayDiversityAudit.distinctRegionsCount}/{relayDiversityAudit.minDistinctRelayRegions}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Providers {relayDiversityAudit.distinctProvidersCount}/{relayDiversityAudit.minDistinctRelayProviders}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Operators {relayDiversityAudit.distinctOperatorsCount}/{relayDiversityAudit.minDistinctRelayOperators}
            </Badge>
            {typeof relayDiversityAudit.dominantProviderSharePercent === 'number' && (
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Top provider share {relayDiversityAudit.dominantProviderSharePercent}%
              </Badge>
            )}
          </div>
        </div>
      )}

      {!canManageGuardianRelays ? (
        <p className="text-sm text-muted-foreground">
          Relay management is limited to guardian multisig stewards.
        </p>
      ) : (
        <GovernanceGuardianRelayNodeAndAttestationControls
          externalSigners={externalSigners}
          relayNodes={relayNodes}
          relayAttestations={relayAttestations}
          registeringRelayNode={registeringRelayNode}
          recordingRelayAttestation={recordingRelayAttestation}
          togglingRelayNodeId={togglingRelayNodeId}
          onRegisterRelayNode={registerRelayNode}
          onSetRelayNodeActive={setRelayNodeActive}
          onRecordRelayAttestation={recordRelayAttestation}
        />
      )}

      <GovernanceGuardianRelayProofSection
        canManageGuardianRelays={canManageGuardianRelays}
        clientDistributionRequiredForExecution={Boolean(relayOperationsSummary?.requireTrustMinimizedQuorum)}
        relayTrustMinimizedSummary={relayTrustMinimizedSummary}
        relayClientProofManifest={relayClientProofManifest}
        relayRecentClientManifests={relayRecentClientManifests}
        relayClientVerificationPackage={relayClientVerificationPackage}
        relayRecentClientVerificationPackages={relayRecentClientVerificationPackages}
        relayClientVerificationDistributionSummary={relayClientVerificationDistributionSummary}
        relayClientVerificationSignatures={relayClientVerificationSignatures}
        capturingRelayClientManifest={capturingRelayClientManifest}
        capturingRelayClientVerificationPackage={capturingRelayClientVerificationPackage}
        signingRelayClientVerificationPackage={signingRelayClientVerificationPackage}
        onCaptureRelayClientManifest={captureRelayClientManifest}
        onCaptureRelayClientVerificationPackage={captureRelayClientVerificationPackage}
        onSignRelayClientVerificationPackage={signRelayClientVerificationPackage}
        formatTimestamp={formatTimestamp}
      />

      {canManageGuardianRelays && (
        <GovernanceGuardianRelayOpsControls
          relayOperationsSummary={relayOperationsSummary}
          relayAlertBoardRows={relayAlertBoardRows}
          relayWorkerRunBoardRows={relayWorkerRunBoardRows}
          savingRelayOpsRequirement={savingRelayOpsRequirement}
          recordingRelayWorkerRun={recordingRelayWorkerRun}
          openingRelayAlert={openingRelayAlert}
          resolvingRelayAlert={resolvingRelayAlert}
          escalatingCriticalRelayPublicExecution={escalatingCriticalRelayPublicExecution}
          syncingRelaySlaAlerts={syncingRelaySlaAlerts}
          formatTimestamp={formatTimestamp}
          onSaveRelayOpsRequirement={saveRelayOpsRequirement}
          onRecordRelayWorkerRun={recordRelayWorkerRun}
          onOpenRelayAlert={openRelayAlert}
          onResolveRelayAlert={resolveRelayAlert}
          onEscalateOpenCriticalRelayAlertsToPublicExecution={escalateOpenCriticalRelayAlertsToPublicExecution}
          onSyncRelayAttestationSlaAlerts={syncRelayAttestationSlaAlerts}
        />
      )}

      <GovernanceGuardianRelayAuditSection
        canManageGuardianRelays={canManageGuardianRelays}
        relayAttestationAuditRows={relayAttestationAuditRows}
        relayRecentAuditReports={relayRecentAuditReports}
        capturingRelayAuditReport={capturingRelayAuditReport}
        onCaptureRelayAuditReport={captureRelayAuditReport}
        formatTimestamp={formatTimestamp}
      />
    </div>
  );
}
