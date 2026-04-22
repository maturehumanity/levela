import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

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
import type { Database, Json } from '@/integrations/supabase/types';
import type { GuardianExternalSignerRow } from '@/lib/governance-guardian-multisig';
import type { GuardianRelayAttestationRow, GuardianRelayNodeRow } from '@/lib/governance-guardian-relays';

interface GovernanceGuardianRelayNodeAndAttestationControlsProps {
  externalSigners: GuardianExternalSignerRow[];
  relayNodes: GuardianRelayNodeRow[];
  relayAttestations: GuardianRelayAttestationRow[];
  registeringRelayNode: boolean;
  recordingRelayAttestation: boolean;
  togglingRelayNodeId: string | null;
  onRegisterRelayNode: (draft: {
    relayKey: string;
    relayLabel: string;
    endpointUrl: string;
    keyAlgorithm: string;
    relayRegionCode: string;
    relayInfrastructureProvider: string;
    relayOperatorLabel: string;
    relayOperatorUri: string;
    relayJurisdictionCountryCode: string;
    relayTrustDomain: string;
  }) => Promise<void> | void;
  onSetRelayNodeActive: (relayNodeId: string, isActive: boolean) => Promise<void> | void;
  onRecordRelayAttestation: (draft: {
    externalSignerId: string;
    relayId: string;
    decision: Database['public']['Enums']['governance_guardian_decision'];
    status: Database['public']['Enums']['governance_guardian_relay_attestation_status'];
    payloadHash: string;
    relayReference: string;
    chainNetwork: string;
    chainReference: string;
  }) => Promise<void> | void;
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

export function GovernanceGuardianRelayNodeAndAttestationControls({
  externalSigners,
  relayNodes,
  relayAttestations,
  registeringRelayNode,
  recordingRelayAttestation,
  togglingRelayNodeId,
  onRegisterRelayNode,
  onSetRelayNodeActive,
  onRecordRelayAttestation,
}: GovernanceGuardianRelayNodeAndAttestationControlsProps) {
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

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Relay node registry</p>
        <Input value={relayNodeDraft.relayKey} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayKey: event.target.value }))} placeholder="Relay key" />
        <Input value={relayNodeDraft.relayLabel} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayLabel: event.target.value }))} placeholder="Relay label" />
        <Input value={relayNodeDraft.endpointUrl} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, endpointUrl: event.target.value }))} placeholder="Relay endpoint URL" />
        <Input value={relayNodeDraft.keyAlgorithm} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, keyAlgorithm: event.target.value }))} placeholder="Key algorithm" />
        <Input value={relayNodeDraft.relayRegionCode} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayRegionCode: event.target.value.toUpperCase() }))} placeholder="Relay region code" />
        <Input value={relayNodeDraft.relayInfrastructureProvider} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayInfrastructureProvider: event.target.value }))} placeholder="Infrastructure provider" />
        <Input value={relayNodeDraft.relayOperatorLabel} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayOperatorLabel: event.target.value }))} placeholder="Operator label" />
        <Input value={relayNodeDraft.relayOperatorUri} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayOperatorUri: event.target.value }))} placeholder="Operator URI (optional)" />
        <Input
          value={relayNodeDraft.relayJurisdictionCountryCode}
          onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayJurisdictionCountryCode: event.target.value.toUpperCase() }))}
          placeholder="Jurisdiction country code (optional)"
          maxLength={2}
        />
        <Input value={relayNodeDraft.relayTrustDomain} onChange={(event) => setRelayNodeDraft((current) => ({ ...current, relayTrustDomain: event.target.value.toLowerCase() }))} placeholder="Trust domain" />
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={registeringRelayNode} onClick={() => void onRegisterRelayNode(relayNodeDraft)}>
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
                  <Button type="button" size="sm" variant="outline" disabled={togglingRelayNodeId === relay.id} onClick={() => void onSetRelayNodeActive(relay.id, !relay.is_active)}>
                    {togglingRelayNodeId === relay.id ? <Loader2 className="h-4 w-4 animate-spin" /> : relay.is_active ? 'Disable' : 'Enable'}
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
        <Select value={attestationDraft.externalSignerId} onValueChange={(value) => setAttestationDraft((current) => ({ ...current, externalSignerId: value }))}>
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
        <Select value={attestationDraft.relayId} onValueChange={(value) => setAttestationDraft((current) => ({ ...current, relayId: value }))}>
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
        <Input value={attestationDraft.payloadHash} onChange={(event) => setAttestationDraft((current) => ({ ...current, payloadHash: event.target.value }))} placeholder="Payload hash (optional)" />
        <Input value={attestationDraft.relayReference} onChange={(event) => setAttestationDraft((current) => ({ ...current, relayReference: event.target.value }))} placeholder="Relay reference (optional)" />
        <Input value={attestationDraft.chainNetwork} onChange={(event) => setAttestationDraft((current) => ({ ...current, chainNetwork: event.target.value }))} placeholder="Chain network (optional)" />
        <Input value={attestationDraft.chainReference} onChange={(event) => setAttestationDraft((current) => ({ ...current, chainReference: event.target.value }))} placeholder="Chain reference (optional)" />
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={recordingRelayAttestation} onClick={() => void onRecordRelayAttestation(attestationDraft)}>
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
  );
}
