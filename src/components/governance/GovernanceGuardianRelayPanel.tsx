import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GovernanceGuardianRelayAuditSection } from '@/components/governance/GovernanceGuardianRelayAuditSection';
import { GovernanceGuardianRelayProofSection } from '@/components/governance/GovernanceGuardianRelayProofSection';
import type { Database, Json } from '@/integrations/supabase/types';
import type { GuardianExternalSignerRow } from '@/lib/governance-guardian-multisig';
import type { GuardianRelayNodeRow } from '@/lib/governance-guardian-relays';
import { useGovernanceGuardianRelays } from '@/lib/use-governance-guardian-relays';
interface GovernanceGuardianRelayPanelProps {
  proposalId: string;
  externalSigners: GuardianExternalSignerRow[];
}
function readRelayMetadataValue(metadata: Json, key: string, fallback = '') {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return fallback;
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
}

function readRelayDiversityProfile(relay: GuardianRelayNodeRow) {
  return {
    region: readRelayMetadataValue(relay.metadata, 'relay_region_code', 'GLOBAL'),
    provider: readRelayMetadataValue(relay.metadata, 'relay_infrastructure_provider', 'unspecified'),
    operator: readRelayMetadataValue(relay.metadata, 'relay_operator_label', 'unspecified'),
    trustDomain: readRelayMetadataValue(relay.metadata, 'relay_trust_domain', 'public'),
    jurisdiction: readRelayMetadataValue(relay.metadata, 'relay_jurisdiction_country_code', ''),
  };
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
    savingRelayOpsRequirement,
    recordingRelayWorkerRun,
    openingRelayAlert,
    resolvingRelayAlert,
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
    relayAlertBoardRows,
    relayWorkerRunBoardRows,
    loadRelayData,
    registerRelayNode,
    setRelayNodeActive,
    recordRelayAttestation,
    captureRelayAuditReport,
    captureRelayClientManifest,
    saveRelayOpsRequirement,
    recordRelayWorkerRun,
    openRelayAlert,
    resolveRelayAlert,
  } = useGovernanceGuardianRelays({ proposalId });

  const [relayNodeDraft, setRelayNodeDraft] = useState({
    relayKey: '',
    relayLabel: '',
    endpointUrl: '',
    keyAlgorithm: 'ECDSA_P256_SHA256_V1',
    relayRegionCode: 'GLOBAL',
    relayInfrastructureProvider: '',
    relayOperatorLabel: '',
    relayOperatorUri: '',
    relayJurisdictionCountryCode: '',
    relayTrustDomain: 'public',
  });
  const [attestationDraft, setAttestationDraft] = useState({
    externalSignerId: '',
    relayId: '',
    decision: 'approve' as Database['public']['Enums']['governance_guardian_decision'],
    status: 'verified' as Database['public']['Enums']['governance_guardian_relay_attestation_status'],
    payloadHash: '',
    relayReference: '',
    chainNetwork: '',
    chainReference: '',
  });
  const [opsRequirementDraft, setOpsRequirementDraft] = useState({
    requireTrustMinimizedQuorum: false,
    requireRelayOpsReadiness: false,
    maxOpenCriticalRelayAlerts: '0',
    relayAttestationSlaMinutes: '120',
  });
  const [workerRunDraft, setWorkerRunDraft] = useState({
    runScope: 'manual' as 'attestation_sweep' | 'diversity_audit' | 'manifest_capture' | 'manual',
    runStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    processedSignerCount: '',
    staleSignerCount: '',
    openAlertCount: '',
    errorMessage: '',
  });
  const [alertDraft, setAlertDraft] = useState({
    alertKey: '',
    severity: 'warning' as 'info' | 'warning' | 'critical',
    alertScope: 'manual',
    alertMessage: '',
  });
  const [resolveAlertDraft, setResolveAlertDraft] = useState({
    alertId: '',
    resolutionNotes: '',
  });

  const activeRelayNodes = useMemo(
    () => relayNodes.filter((relay) => relay.is_active),
    [relayNodes],
  );
  const openRelayAlerts = useMemo(
    () => relayAlertBoardRows.filter((alert) => alert.alertStatus === 'open' || alert.alertStatus === 'acknowledged'),
    [relayAlertBoardRows],
  );

  useEffect(() => {
    if (!relayOperationsSummary) return;
    setOpsRequirementDraft({
      requireTrustMinimizedQuorum: relayOperationsSummary.requireTrustMinimizedQuorum,
      requireRelayOpsReadiness: relayOperationsSummary.requireRelayOpsReadiness,
      maxOpenCriticalRelayAlerts: String(relayOperationsSummary.maxOpenCriticalRelayAlerts),
      relayAttestationSlaMinutes: String(relayOperationsSummary.relayAttestationSlaMinutes),
    });
  }, [relayOperationsSummary]);

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
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Relay node registry</p>
            <Input
              value={relayNodeDraft.relayKey}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayKey: event.target.value }))}
              placeholder="Relay key"
            />
            <Input
              value={relayNodeDraft.relayLabel}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayLabel: event.target.value }))}
              placeholder="Relay label"
            />
            <Input
              value={relayNodeDraft.endpointUrl}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
              placeholder="Relay endpoint URL"
            />
            <Input
              value={relayNodeDraft.keyAlgorithm}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, keyAlgorithm: event.target.value }))}
              placeholder="Key algorithm"
            />
            <Input
              value={relayNodeDraft.relayRegionCode}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayRegionCode: event.target.value.toUpperCase() }))}
              placeholder="Relay region code"
            />
            <Input
              value={relayNodeDraft.relayInfrastructureProvider}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayInfrastructureProvider: event.target.value }))}
              placeholder="Infrastructure provider"
            />
            <Input
              value={relayNodeDraft.relayOperatorLabel}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayOperatorLabel: event.target.value }))}
              placeholder="Operator label"
            />
            <Input
              value={relayNodeDraft.relayOperatorUri}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayOperatorUri: event.target.value }))}
              placeholder="Operator URI (optional)"
            />
            <Input
              value={relayNodeDraft.relayJurisdictionCountryCode}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayJurisdictionCountryCode: event.target.value.toUpperCase() }))}
              placeholder="Jurisdiction country code (optional)"
              maxLength={2}
            />
            <Input
              value={relayNodeDraft.relayTrustDomain}
              onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayTrustDomain: event.target.value.toLowerCase() }))}
              placeholder="Trust domain"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={registeringRelayNode}
              onClick={() => void registerRelayNode(relayNodeDraft)}
            >
              {registeringRelayNode ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save relay node
            </Button>

            <div className="space-y-2">
              {relayNodes.map((relay) => {
                const diversity = readRelayDiversityProfile(relay);
                return (
                  <div key={relay.id} className="rounded-md border border-border/60 bg-background p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{relay.relay_label || relay.relay_key}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={togglingRelayNodeId === relay.id}
                        onClick={() => void setRelayNodeActive(relay.id, !relay.is_active)}
                      >
                        {togglingRelayNodeId === relay.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : relay.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {diversity.region} • {diversity.provider} • {diversity.operator} • {diversity.trustDomain}
                      {diversity.jurisdiction ? ` • ${diversity.jurisdiction}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Record relay attestation</p>
            <Label className="text-xs">External signer</Label>
            <Select
              value={attestationDraft.externalSignerId}
              onValueChange={(value) => setAttestationDraft((current) => ({ ...current, externalSignerId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select external signer" />
              </SelectTrigger>
              <SelectContent>
                {externalSigners.map((signer) => (
                  <SelectItem key={signer.id} value={signer.id}>
                    {signer.signer_label || signer.signer_key.slice(0, 56)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs">Relay node</Label>
            <Select
              value={attestationDraft.relayId}
              onValueChange={(value) => setAttestationDraft((current) => ({ ...current, relayId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select relay node" />
              </SelectTrigger>
              <SelectContent>
                {activeRelayNodes.map((relay) => (
                  <SelectItem key={relay.id} value={relay.id}>
                    {relay.relay_label || relay.relay_key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={attestationDraft.status}
              onValueChange={(value) => setAttestationDraft((current) => ({
                ...current,
                status: value as Database['public']['Enums']['governance_guardian_relay_attestation_status'],
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Attestation status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="mismatch">Mismatch</SelectItem>
                <SelectItem value="unreachable">Unreachable</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={attestationDraft.payloadHash}
              onChange={(event) => setAttestationDraft((current) => ({ ...current, payloadHash: event.target.value }))}
              placeholder="Payload hash (optional)"
            />
            <Input
              value={attestationDraft.relayReference}
              onChange={(event) => setAttestationDraft((current) => ({ ...current, relayReference: event.target.value }))}
              placeholder="Relay reference (optional)"
            />
            <Input
              value={attestationDraft.chainNetwork}
              onChange={(event) => setAttestationDraft((current) => ({ ...current, chainNetwork: event.target.value }))}
              placeholder="Chain network (optional)"
            />
            <Input
              value={attestationDraft.chainReference}
              onChange={(event) => setAttestationDraft((current) => ({ ...current, chainReference: event.target.value }))}
              placeholder="Chain reference (optional)"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={recordingRelayAttestation}
              onClick={() => void recordRelayAttestation(attestationDraft)}
            >
              {recordingRelayAttestation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Record relay attestation
            </Button>
            {relayAttestations.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Latest attestations: {relayAttestations.length}
              </p>
            )}
          </div>
        </div>
      )}

      <GovernanceGuardianRelayProofSection
        canManageGuardianRelays={canManageGuardianRelays}
        relayTrustMinimizedSummary={relayTrustMinimizedSummary}
        relayClientProofManifest={relayClientProofManifest}
        relayRecentClientManifests={relayRecentClientManifests}
        capturingRelayClientManifest={capturingRelayClientManifest}
        onCaptureRelayClientManifest={captureRelayClientManifest}
        formatTimestamp={formatTimestamp}
      />

      {relayOperationsSummary && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5 text-xs">
          <p className="font-medium text-foreground">Relay operations hardening</p>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={relayOperationsSummary.trustMinimizedQuorumMet
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Trust-minimized quorum {relayOperationsSummary.trustMinimizedQuorumMet ? 'met' : 'pending'}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Stale signers {relayOperationsSummary.staleSignerCount}/{relayOperationsSummary.externalApprovalCount}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Critical alerts {relayOperationsSummary.openCriticalAlertCount}/{relayOperationsSummary.maxOpenCriticalRelayAlerts}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              SLA {relayOperationsSummary.relayAttestationSlaMinutes}m
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Last worker run {formatTimestamp(relayOperationsSummary.lastWorkerRunAt)} • {relayOperationsSummary.lastWorkerRunStatus}
          </p>
        </div>
      )}

      {canManageGuardianRelays && (
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ops requirements</p>
            <Select
              value={opsRequirementDraft.requireTrustMinimizedQuorum ? 'yes' : 'no'}
              onValueChange={(value) => setOpsRequirementDraft((current) => ({
                ...current,
                requireTrustMinimizedQuorum: value === 'yes',
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Require trust-minimized quorum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Require trust-minimized quorum</SelectItem>
                <SelectItem value="no">Allow without trust-minimized quorum</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={opsRequirementDraft.requireRelayOpsReadiness ? 'yes' : 'no'}
              onValueChange={(value) => setOpsRequirementDraft((current) => ({
                ...current,
                requireRelayOpsReadiness: value === 'yes',
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Require relay ops readiness" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Require relay ops readiness</SelectItem>
                <SelectItem value="no">Allow without relay ops readiness</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={opsRequirementDraft.maxOpenCriticalRelayAlerts}
              onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, maxOpenCriticalRelayAlerts: event.target.value }))}
              placeholder="Max open critical alerts"
            />
            <Input
              value={opsRequirementDraft.relayAttestationSlaMinutes}
              onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, relayAttestationSlaMinutes: event.target.value }))}
              placeholder="Relay attestation SLA minutes"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={savingRelayOpsRequirement}
              onClick={() => void saveRelayOpsRequirement(opsRequirementDraft)}
            >
              {savingRelayOpsRequirement ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save relay ops requirements
            </Button>

            <p className="text-xs text-muted-foreground">
              Worker runs tracked: {relayWorkerRunBoardRows.length} • Alerts tracked: {relayAlertBoardRows.length}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Record worker run</p>
            <Select
              value={workerRunDraft.runScope}
              onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runScope: value as typeof current.runScope }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Run scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attestation_sweep">Attestation sweep</SelectItem>
                <SelectItem value="diversity_audit">Diversity audit</SelectItem>
                <SelectItem value="manifest_capture">Manifest capture</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={workerRunDraft.runStatus}
              onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runStatus: value as typeof current.runStatus }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Run status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={workerRunDraft.processedSignerCount}
              onChange={(event) => setWorkerRunDraft((current) => ({ ...current, processedSignerCount: event.target.value }))}
              placeholder="Processed signer count"
            />
            <Input
              value={workerRunDraft.staleSignerCount}
              onChange={(event) => setWorkerRunDraft((current) => ({ ...current, staleSignerCount: event.target.value }))}
              placeholder="Stale signer count"
            />
            <Input
              value={workerRunDraft.openAlertCount}
              onChange={(event) => setWorkerRunDraft((current) => ({ ...current, openAlertCount: event.target.value }))}
              placeholder="Open alert count"
            />
            <Input
              value={workerRunDraft.errorMessage}
              onChange={(event) => setWorkerRunDraft((current) => ({ ...current, errorMessage: event.target.value }))}
              placeholder="Error message (optional)"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={recordingRelayWorkerRun}
              onClick={() => void recordRelayWorkerRun(workerRunDraft)}
            >
              {recordingRelayWorkerRun ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save worker run
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Open relay alert</p>
            <Input
              value={alertDraft.alertKey}
              onChange={(event) => setAlertDraft((current) => ({ ...current, alertKey: event.target.value }))}
              placeholder="Alert key"
            />
            <Select
              value={alertDraft.severity}
              onValueChange={(value) => setAlertDraft((current) => ({ ...current, severity: value as typeof current.severity }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alert severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={alertDraft.alertScope}
              onChange={(event) => setAlertDraft((current) => ({ ...current, alertScope: event.target.value }))}
              placeholder="Alert scope"
            />
            <Input
              value={alertDraft.alertMessage}
              onChange={(event) => setAlertDraft((current) => ({ ...current, alertMessage: event.target.value }))}
              placeholder="Alert message"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={openingRelayAlert || !alertDraft.alertKey.trim() || !alertDraft.alertMessage.trim()}
              onClick={() => void openRelayAlert(alertDraft)}
            >
              {openingRelayAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Open relay alert
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Resolve relay alert</p>
            <Select
              value={resolveAlertDraft.alertId}
              onValueChange={(value) => setResolveAlertDraft((current) => ({ ...current, alertId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select open alert" />
              </SelectTrigger>
              <SelectContent>
                {openRelayAlerts.map((alert) => (
                  <SelectItem key={alert.alertId} value={alert.alertId}>
                    {alert.alertKey} • {alert.severity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={resolveAlertDraft.resolutionNotes}
              onChange={(event) => setResolveAlertDraft((current) => ({ ...current, resolutionNotes: event.target.value }))}
              placeholder="Resolution notes (optional)"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={resolvingRelayAlert || !resolveAlertDraft.alertId}
              onClick={() => void resolveRelayAlert(resolveAlertDraft)}
            >
              {resolvingRelayAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Resolve relay alert
            </Button>

            <div className="space-y-1 text-xs text-muted-foreground">
              {relayAlertBoardRows.slice(0, 4).map((alert) => (
                <p key={alert.alertId}>
                  {alert.alertKey} • {alert.severity} • {alert.alertStatus} • {formatTimestamp(alert.openedAt)}
                </p>
              ))}
            </div>
          </div>
        </div>
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
