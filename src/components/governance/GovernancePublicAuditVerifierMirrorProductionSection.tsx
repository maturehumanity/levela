import { Loader2 } from 'lucide-react';

import { GovernancePublicAuditVerifierMirrorDirectoryCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorDirectoryCard';
import { GovernancePublicAuditVerifierMirrorFailoverPolicyCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorFailoverPolicyCard';
import { GovernancePublicAuditVerifierMirrorFederationCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationCard';
import { GovernancePublicAuditVerifierMirrorProbeJobsCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorProbeJobsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGovernancePublicAuditVerifierMirrorProduction } from '@/lib/use-governance-public-audit-verifier-mirror-production';
import { useGovernancePublicAuditVerifierMirrorFederation } from '@/lib/use-governance-public-audit-verifier-mirror-federation';
import { useGovernancePublicAuditVerifierMirrorSignerGovernance } from '@/lib/use-governance-public-audit-verifier-mirror-signer-governance';

interface GovernancePublicAuditVerifierMirrorProductionSectionProps {
  latestBatchId: string | null;
  formatTimestamp: (value: string | null) => string;
}

export function GovernancePublicAuditVerifierMirrorProductionSection({
  latestBatchId,
  formatTimestamp,
}: GovernancePublicAuditVerifierMirrorProductionSectionProps) {
  const {
    loadingProductionData,
    productionBackendUnavailable,
    canManageMirrorProduction,
    savingFailoverPolicy,
    registeringDirectorySigner,
    publishingSignedDirectory,
    savingDirectoryAttestation,
    schedulingProbeJobs,
    completingProbeJob,
    failoverPolicy,
    federationDistributionGateSnapshot,
    directorySummaries,
    directoryTrustSummary,
    probeJobSummary,
    probeJobs,
    loadProductionData,
    saveFailoverPolicy,
    registerDirectorySigner,
    publishSignedDirectory,
    recordDirectoryAttestation,
    scheduleProbeJobs,
    completeProbeJob,
  } = useGovernancePublicAuditVerifierMirrorProduction({ latestBatchId });
  const {
    loadingFederationData,
    federationBackendUnavailable,
    canManageMirrorFederation,
    registeringDiscoverySource,
    recordingDiscoveryRun,
    upsertingDiscoveredCandidate,
    promotingDiscoveredCandidate,
    savingPolicyRatification,
    capturingFederationPackage,
    signingFederationPackage,
    verifyingFederationDistribution,
    savingFederationOpsRequirement,
    registeringFederationOperator,
    submittingOnboardingRequest,
    reviewingOnboardingRequest,
    onboardingFederationRequest,
    recordingFederationWorkerRun,
    openingFederationAlert,
    resolvingFederationAlert,
    policyRatificationSummary,
    discoverySummary,
    federationOperationsSummary,
    federationPackage,
    federationPackageDistributionSummary,
    federationPackageSignatures,
    federationPackageHistory,
    discoverySources,
    discoveredCandidates,
    federationOnboardingBoard,
    federationAlertBoard,
    federationWorkerRuns,
    federationDistributionEscalationOpenPageCount,
    loadFederationData,
    registerDiscoverySource,
    recordDiscoveryRun,
    upsertDiscoveredCandidate,
    promoteDiscoveredCandidate,
    recordPolicyRatification,
    captureFederationPackage,
    signFederationPackage,
    runFederationDistributionVerification,
    saveFederationOpsRequirement,
    registerFederationOperator,
    submitFederationOnboardingRequest,
    reviewFederationOnboardingRequest,
    onboardFederationRequest,
    recordFederationWorkerRun,
    openFederationAlert,
    resolveFederationAlert,
  } = useGovernancePublicAuditVerifierMirrorFederation({ latestBatchId });
  const {
    loadingSignerGovernanceData,
    signerGovernanceBackendUnavailable,
    canManageSignerGovernance,
    savingSignerGovernanceRequirement,
    savingSignerGovernanceAttestation,
    signerGovernanceSummary,
    signerGovernanceBoard,
    loadSignerGovernanceData,
    saveSignerGovernanceRequirement,
    saveSignerGovernanceAttestation,
  } = useGovernancePublicAuditVerifierMirrorSignerGovernance();

  if (productionBackendUnavailable && federationBackendUnavailable && signerGovernanceBackendUnavailable) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Mirror production rollout</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={loadingProductionData || loadingFederationData || loadingSignerGovernanceData}
          onClick={() => {
            void Promise.all([loadProductionData(), loadFederationData(), loadSignerGovernanceData()]);
          }}
        >
          {loadingProductionData || loadingFederationData || loadingSignerGovernanceData ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh rollout
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {probeJobSummary && (
          <Badge
            variant="outline"
            className={probeJobSummary.pendingSlaMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'}
          >
            Probe SLA {probeJobSummary.pendingSlaMet ? 'met' : 'breached'}
          </Badge>
        )}
        {probeJobSummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Pending {probeJobSummary.pendingCount + probeJobSummary.runningCount}
          </Badge>
        )}
        {failoverPolicy && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Min healthy mirrors {failoverPolicy.minHealthyMirrors}
          </Badge>
        )}
        {failoverPolicy && (
          <Badge
            variant="outline"
            className={failoverPolicy.requirePolicyRatification
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-border bg-muted text-muted-foreground'}
          >
            Policy ratification {failoverPolicy.requirePolicyRatification ? 'required' : 'optional'}
          </Badge>
        )}
        {policyRatificationSummary && (
          <Badge
            variant="outline"
            className={policyRatificationSummary.ratificationMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Ratification quorum {policyRatificationSummary.ratificationMet ? 'met' : 'pending'}
          </Badge>
        )}
        {discoverySummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Discovery candidates {discoverySummary.candidateCount}
          </Badge>
        )}
        {signerGovernanceSummary && (
          <Badge
            variant="outline"
            className={signerGovernanceSummary.governanceReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Signer governance {signerGovernanceSummary.governanceReady ? 'ready' : 'pending'}
          </Badge>
        )}
        {federationOperationsSummary && (
          <Badge
            variant="outline"
            className={federationOperationsSummary.federationOpsReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Federation ops {federationOperationsSummary.federationOpsReady ? 'ready' : 'pending'}
          </Badge>
        )}
        {federationPackageDistributionSummary && (
          <Badge
            variant="outline"
            className={federationPackageDistributionSummary.distributionReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Federation package {federationPackageDistributionSummary.distributionReady ? 'ready' : 'pending'}
          </Badge>
        )}
        {directoryTrustSummary && (
          <Badge
            variant="outline"
            className={directoryTrustSummary.trustQuorumMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Directory trust {directoryTrustSummary.trustQuorumMet ? 'met' : 'pending'}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
        <GovernancePublicAuditVerifierMirrorFailoverPolicyCard
          canManageMirrorProduction={canManageMirrorProduction}
          savingFailoverPolicy={savingFailoverPolicy}
          failoverPolicy={failoverPolicy}
          federationDistributionGateSnapshot={federationDistributionGateSnapshot}
          formatTimestamp={formatTimestamp}
          saveFailoverPolicy={saveFailoverPolicy}
        />

        <GovernancePublicAuditVerifierMirrorDirectoryCard
          canManageMirrorProduction={canManageMirrorProduction}
          registeringDirectorySigner={registeringDirectorySigner}
          publishingSignedDirectory={publishingSignedDirectory}
          savingDirectoryAttestation={savingDirectoryAttestation}
          directorySummaries={directorySummaries}
          directoryTrustSummary={directoryTrustSummary}
          formatTimestamp={formatTimestamp}
          registerDirectorySigner={registerDirectorySigner}
          publishSignedDirectory={publishSignedDirectory}
          recordDirectoryAttestation={recordDirectoryAttestation}
        />

        <GovernancePublicAuditVerifierMirrorProbeJobsCard
          canManageMirrorProduction={canManageMirrorProduction}
          schedulingProbeJobs={schedulingProbeJobs}
          completingProbeJob={completingProbeJob}
          probeJobSummary={probeJobSummary}
          probeJobs={probeJobs}
          formatTimestamp={formatTimestamp}
          scheduleProbeJobs={scheduleProbeJobs}
          completeProbeJob={completeProbeJob}
        />
        <GovernancePublicAuditVerifierMirrorFederationCard
          canManageMirrorFederation={canManageMirrorFederation}
          registeringDiscoverySource={registeringDiscoverySource}
          recordingDiscoveryRun={recordingDiscoveryRun}
          upsertingDiscoveredCandidate={upsertingDiscoveredCandidate}
          promotingDiscoveredCandidate={promotingDiscoveredCandidate}
          savingPolicyRatification={savingPolicyRatification}
          capturingFederationPackage={capturingFederationPackage}
          signingFederationPackage={signingFederationPackage}
          verifyingFederationDistribution={verifyingFederationDistribution}
          savingFederationOpsRequirement={savingFederationOpsRequirement}
          registeringFederationOperator={registeringFederationOperator}
          submittingOnboardingRequest={submittingOnboardingRequest}
          reviewingOnboardingRequest={reviewingOnboardingRequest}
          onboardingFederationRequest={onboardingFederationRequest}
          recordingFederationWorkerRun={recordingFederationWorkerRun}
          openingFederationAlert={openingFederationAlert}
          resolvingFederationAlert={resolvingFederationAlert}
          canManageSignerGovernance={canManageSignerGovernance}
          savingSignerGovernanceRequirement={savingSignerGovernanceRequirement}
          savingSignerGovernanceAttestation={savingSignerGovernanceAttestation}
          policyRatificationSummary={policyRatificationSummary}
          discoverySummary={discoverySummary}
          federationOperationsSummary={federationOperationsSummary}
          federationPackage={federationPackage}
          federationPackageDistributionSummary={federationPackageDistributionSummary}
          federationPackageSignatures={federationPackageSignatures}
          federationPackageHistory={federationPackageHistory}
          signerGovernanceSummary={signerGovernanceSummary}
          discoverySources={discoverySources}
          discoveredCandidates={discoveredCandidates}
          federationOnboardingBoard={federationOnboardingBoard}
          federationAlertBoard={federationAlertBoard}
          federationWorkerRuns={federationWorkerRuns}
          federationDistributionEscalationOpenPageCount={federationDistributionEscalationOpenPageCount}
          signerGovernanceBoard={signerGovernanceBoard}
          formatTimestamp={formatTimestamp}
          registerDiscoverySource={registerDiscoverySource}
          recordDiscoveryRun={recordDiscoveryRun}
          upsertDiscoveredCandidate={upsertDiscoveredCandidate}
          promoteDiscoveredCandidate={promoteDiscoveredCandidate}
          recordPolicyRatification={recordPolicyRatification}
          captureFederationPackage={captureFederationPackage}
          signFederationPackage={signFederationPackage}
          runFederationDistributionVerification={runFederationDistributionVerification}
          saveFederationOpsRequirement={saveFederationOpsRequirement}
          registerFederationOperator={registerFederationOperator}
          submitFederationOnboardingRequest={submitFederationOnboardingRequest}
          reviewFederationOnboardingRequest={reviewFederationOnboardingRequest}
          onboardFederationRequest={onboardFederationRequest}
          recordFederationWorkerRun={recordFederationWorkerRun}
          openFederationAlert={openFederationAlert}
          resolveFederationAlert={resolveFederationAlert}
          saveSignerGovernanceRequirement={saveSignerGovernanceRequirement}
          saveSignerGovernanceAttestation={saveSignerGovernanceAttestation}
        />
      </div>
    </div>
  );
}
