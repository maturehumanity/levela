import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { GovernancePublicAuditVerifierMirrorDirectoryCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorDirectoryCard';
import { GovernancePublicAuditVerifierMirrorFederationCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationCard';
import { GovernancePublicAuditVerifierMirrorProbeJobsCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorProbeJobsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    discoverySources,
    discoveredCandidates,
    federationOnboardingBoard,
    federationAlertBoard,
    loadFederationData,
    registerDiscoverySource,
    recordDiscoveryRun,
    upsertDiscoveredCandidate,
    promoteDiscoveredCandidate,
    recordPolicyRatification,
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

  const [failoverDraft, setFailoverDraft] = useState({
    minHealthyMirrors: '1',
    maxMirrorLatencyMs: '2500',
    maxFailuresBeforeCooldown: '2',
    cooldownMinutes: '10',
    preferSameRegion: false,
    requiredDistinctRegions: '1',
    requiredDistinctOperators: '1',
    mirrorSelectionStrategy: 'health_latency_diversity',
    maxMirrorCandidates: '8',
    minIndependentDirectorySigners: '1',
    requirePolicyRatification: false,
    minPolicyRatificationApprovals: '1',
  });

  useEffect(() => {
    if (!failoverPolicy) return;
    setFailoverDraft({
      minHealthyMirrors: String(failoverPolicy.minHealthyMirrors),
      maxMirrorLatencyMs: String(failoverPolicy.maxMirrorLatencyMs),
      maxFailuresBeforeCooldown: String(failoverPolicy.maxFailuresBeforeCooldown),
      cooldownMinutes: String(failoverPolicy.cooldownMinutes),
      preferSameRegion: failoverPolicy.preferSameRegion,
      requiredDistinctRegions: String(failoverPolicy.requiredDistinctRegions),
      requiredDistinctOperators: String(failoverPolicy.requiredDistinctOperators),
      mirrorSelectionStrategy: failoverPolicy.mirrorSelectionStrategy,
      maxMirrorCandidates: String(failoverPolicy.maxMirrorCandidates),
      minIndependentDirectorySigners: String(failoverPolicy.minIndependentDirectorySigners),
      requirePolicyRatification: failoverPolicy.requirePolicyRatification,
      minPolicyRatificationApprovals: String(failoverPolicy.minPolicyRatificationApprovals),
    });
  }, [failoverPolicy]);

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
        <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
          <p className="font-medium text-foreground">Client failover policy</p>
          <Input
            value={failoverDraft.minHealthyMirrors}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, minHealthyMirrors: event.target.value }))}
            placeholder="Min healthy mirrors"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.maxMirrorLatencyMs}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, maxMirrorLatencyMs: event.target.value }))}
            placeholder="Max mirror latency ms"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.maxFailuresBeforeCooldown}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, maxFailuresBeforeCooldown: event.target.value }))}
            placeholder="Max failures before cooldown"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.cooldownMinutes}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, cooldownMinutes: event.target.value }))}
            placeholder="Cooldown minutes"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.requiredDistinctRegions}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, requiredDistinctRegions: event.target.value }))}
            placeholder="Required distinct regions"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.requiredDistinctOperators}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, requiredDistinctOperators: event.target.value }))}
            placeholder="Required distinct operators"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.maxMirrorCandidates}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, maxMirrorCandidates: event.target.value }))}
            placeholder="Max mirror candidates"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.minIndependentDirectorySigners}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, minIndependentDirectorySigners: event.target.value }))}
            placeholder="Min independent signer approvals"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.minPolicyRatificationApprovals}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, minPolicyRatificationApprovals: event.target.value }))}
            placeholder="Min policy ratification approvals"
            disabled={!canManageMirrorProduction}
          />
          <Input
            value={failoverDraft.mirrorSelectionStrategy}
            onChange={(event) => setFailoverDraft((current) => ({ ...current, mirrorSelectionStrategy: event.target.value }))}
            placeholder="Selection strategy"
            disabled={!canManageMirrorProduction}
          />
          <Select
            value={failoverDraft.preferSameRegion ? 'yes' : 'no'}
            onValueChange={(value) => setFailoverDraft((current) => ({ ...current, preferSameRegion: value === 'yes' }))}
            disabled={!canManageMirrorProduction}
          >
            <SelectTrigger>
              <SelectValue placeholder="Prefer same region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Prefer same region</SelectItem>
              <SelectItem value="no">Do not prefer same region</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={failoverDraft.requirePolicyRatification ? 'yes' : 'no'}
            onValueChange={(value) => setFailoverDraft((current) => ({ ...current, requirePolicyRatification: value === 'yes' }))}
            disabled={!canManageMirrorProduction}
          >
            <SelectTrigger>
              <SelectValue placeholder="Require policy ratification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Require ratification</SelectItem>
              <SelectItem value="no">Allow without ratification</SelectItem>
            </SelectContent>
          </Select>

          {canManageMirrorProduction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={savingFailoverPolicy}
              onClick={() => void saveFailoverPolicy(failoverDraft)}
            >
              {savingFailoverPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save failover policy
            </Button>
          )}

          {failoverPolicy && (
            <p className="text-muted-foreground">
              Updated: {formatTimestamp(failoverPolicy.updatedAt)}
            </p>
          )}
        </div>

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
          signerGovernanceSummary={signerGovernanceSummary}
          discoverySources={discoverySources}
          discoveredCandidates={discoveredCandidates}
          federationOnboardingBoard={federationOnboardingBoard}
          federationAlertBoard={federationAlertBoard}
          signerGovernanceBoard={signerGovernanceBoard}
          formatTimestamp={formatTimestamp}
          registerDiscoverySource={registerDiscoverySource}
          recordDiscoveryRun={recordDiscoveryRun}
          upsertDiscoveredCandidate={upsertDiscoveredCandidate}
          promoteDiscoveredCandidate={promoteDiscoveredCandidate}
          recordPolicyRatification={recordPolicyRatification}
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
