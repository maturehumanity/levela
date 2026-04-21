import { useMemo, useState } from 'react';
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
    togglingRelayNodeId,
    relayPolicy,
    relayNodes,
    relayAttestations,
    relaySummary,
    relayTrustMinimizedSummary,
    relayClientProofManifest,
    relayDiversityAudit,
    relayAttestationAuditRows,
    relayRecentAuditReports,
    relayRecentClientManifests,
    loadRelayData,
    registerRelayNode,
    setRelayNodeActive,
    recordRelayAttestation,
    captureRelayAuditReport,
    captureRelayClientManifest,
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

  const activeRelayNodes = useMemo(
    () => relayNodes.filter((relay) => relay.is_active),
    [relayNodes],
  );

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
