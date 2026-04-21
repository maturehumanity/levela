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
import type {
  GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationControlsProps {
  canManageMirrorFederation: boolean;
  registeringDiscoverySource: boolean;
  recordingDiscoveryRun: boolean;
  upsertingDiscoveredCandidate: boolean;
  promotingDiscoveredCandidate: boolean;
  savingPolicyRatification: boolean;
  discoverySources: GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[];
  discoveredCandidates: GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[];
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

export function GovernancePublicAuditVerifierMirrorFederationControls({
  canManageMirrorFederation,
  registeringDiscoverySource,
  recordingDiscoveryRun,
  upsertingDiscoveredCandidate,
  promotingDiscoveredCandidate,
  savingPolicyRatification,
  discoverySources,
  discoveredCandidates,
  registerDiscoverySource,
  recordDiscoveryRun,
  upsertDiscoveredCandidate,
  promoteDiscoveredCandidate,
  recordPolicyRatification,
}: GovernancePublicAuditVerifierMirrorFederationControlsProps) {
  const [sourceDraft, setSourceDraft] = useState({
    sourceKey: '',
    sourceLabel: '',
    endpointUrl: '',
    discoveryScope: 'public_registry',
    trustTier: 'observer',
  });
  const [runDraft, setRunDraft] = useState({
    sourceId: '',
    runStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    discoveredCount: '',
    acceptedCandidateCount: '',
    staleCandidateCount: '',
    errorMessage: '',
  });
  const [candidateDraft, setCandidateDraft] = useState({
    sourceId: '',
    candidateKey: '',
    candidateLabel: '',
    endpointUrl: '',
    mirrorType: 'https_gateway',
    regionCode: 'GLOBAL',
    jurisdictionCountryCode: '',
    operatorLabel: '',
    trustDomain: 'public',
    discoveryConfidence: '50',
    candidateStatus: 'new' as 'new' | 'reviewed' | 'promoted' | 'rejected' | 'inactive',
  });
  const [promotionCandidateId, setPromotionCandidateId] = useState('');
  const [ratificationDraft, setRatificationDraft] = useState({
    policyKey: 'default',
    signerKey: '',
    ratificationDecision: 'approve' as 'approve' | 'reject',
    ratificationSignature: '',
  });
  const promotableCandidates = useMemo(
    () => discoveredCandidates.filter((candidate) => candidate.candidateStatus === 'new' || candidate.candidateStatus === 'reviewed'),
    [discoveredCandidates],
  );

  if (!canManageMirrorFederation) return null;

  return (
    <>
      <Label className="pt-1 text-xs">Register discovery source</Label>
      <Input
        value={sourceDraft.sourceKey}
        onChange={(event) => setSourceDraft((current) => ({ ...current, sourceKey: event.target.value }))}
        placeholder="Source key"
      />
      <Input
        value={sourceDraft.sourceLabel}
        onChange={(event) => setSourceDraft((current) => ({ ...current, sourceLabel: event.target.value }))}
        placeholder="Source label"
      />
      <Input
        value={sourceDraft.endpointUrl}
        onChange={(event) => setSourceDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
        placeholder="Source endpoint URL"
      />
      <Select
        value={sourceDraft.discoveryScope}
        onValueChange={(value) => setSourceDraft((current) => ({ ...current, discoveryScope: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Discovery scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="public_registry">Public registry</SelectItem>
          <SelectItem value="signed_catalog">Signed catalog</SelectItem>
          <SelectItem value="community_feed">Community feed</SelectItem>
          <SelectItem value="manual_seed">Manual seed</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={sourceDraft.trustTier}
        onValueChange={(value) => setSourceDraft((current) => ({ ...current, trustTier: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Trust tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="observer">Observer</SelectItem>
          <SelectItem value="independent">Independent</SelectItem>
          <SelectItem value="community">Community</SelectItem>
          <SelectItem value="bootstrap">Bootstrap</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={registeringDiscoverySource || !sourceDraft.sourceKey.trim() || !sourceDraft.endpointUrl.trim()}
        onClick={() => void registerDiscoverySource(sourceDraft)}
      >
        {registeringDiscoverySource ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save discovery source
      </Button>

      <Label className="pt-1 text-xs">Record discovery run</Label>
      <Select
        value={runDraft.sourceId}
        onValueChange={(value) => setRunDraft((current) => ({ ...current, sourceId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          {discoverySources.map((source) => (
            <SelectItem key={source.sourceId} value={source.sourceId}>
              {source.sourceLabel || source.sourceKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={runDraft.runStatus}
        onValueChange={(value) => setRunDraft((current) => ({ ...current, runStatus: value as typeof current.runStatus }))}
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
        value={runDraft.discoveredCount}
        onChange={(event) => setRunDraft((current) => ({ ...current, discoveredCount: event.target.value }))}
        placeholder="Discovered count"
      />
      <Input
        value={runDraft.acceptedCandidateCount}
        onChange={(event) => setRunDraft((current) => ({ ...current, acceptedCandidateCount: event.target.value }))}
        placeholder="Accepted candidate count"
      />
      <Input
        value={runDraft.staleCandidateCount}
        onChange={(event) => setRunDraft((current) => ({ ...current, staleCandidateCount: event.target.value }))}
        placeholder="Stale candidate count"
      />
      <Input
        value={runDraft.errorMessage}
        onChange={(event) => setRunDraft((current) => ({ ...current, errorMessage: event.target.value }))}
        placeholder="Error message (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={recordingDiscoveryRun || !runDraft.sourceId}
        onClick={() => void recordDiscoveryRun(runDraft)}
      >
        {recordingDiscoveryRun ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save discovery run
      </Button>

      <Label className="pt-1 text-xs">Upsert discovered candidate</Label>
      <Select
        value={candidateDraft.sourceId}
        onValueChange={(value) => setCandidateDraft((current) => ({ ...current, sourceId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select source" />
        </SelectTrigger>
        <SelectContent>
          {discoverySources.map((source) => (
            <SelectItem key={source.sourceId} value={source.sourceId}>
              {source.sourceLabel || source.sourceKey}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={candidateDraft.candidateKey}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, candidateKey: event.target.value }))}
        placeholder="Candidate key"
      />
      <Input
        value={candidateDraft.candidateLabel}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, candidateLabel: event.target.value }))}
        placeholder="Candidate label"
      />
      <Input
        value={candidateDraft.endpointUrl}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
        placeholder="Candidate endpoint URL"
      />
      <Input
        value={candidateDraft.mirrorType}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, mirrorType: event.target.value }))}
        placeholder="Mirror type"
      />
      <Input
        value={candidateDraft.regionCode}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, regionCode: event.target.value.toUpperCase() }))}
        placeholder="Region code"
      />
      <Input
        value={candidateDraft.jurisdictionCountryCode}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, jurisdictionCountryCode: event.target.value.toUpperCase() }))}
        placeholder="Jurisdiction country code (optional)"
        maxLength={2}
      />
      <Input
        value={candidateDraft.operatorLabel}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, operatorLabel: event.target.value }))}
        placeholder="Operator label"
      />
      <Input
        value={candidateDraft.trustDomain}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, trustDomain: event.target.value }))}
        placeholder="Trust domain"
      />
      <Input
        value={candidateDraft.discoveryConfidence}
        onChange={(event) => setCandidateDraft((current) => ({ ...current, discoveryConfidence: event.target.value }))}
        placeholder="Discovery confidence (0-100)"
      />
      <Select
        value={candidateDraft.candidateStatus}
        onValueChange={(value) => setCandidateDraft((current) => ({ ...current, candidateStatus: value as typeof current.candidateStatus }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Candidate status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="reviewed">Reviewed</SelectItem>
          <SelectItem value="promoted">Promoted</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={upsertingDiscoveredCandidate || !candidateDraft.sourceId || !candidateDraft.candidateKey.trim() || !candidateDraft.endpointUrl.trim()}
        onClick={() => void upsertDiscoveredCandidate(candidateDraft)}
      >
        {upsertingDiscoveredCandidate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save discovered candidate
      </Button>

      <Label className="pt-1 text-xs">Promote discovered candidate</Label>
      <Select value={promotionCandidateId} onValueChange={setPromotionCandidateId}>
        <SelectTrigger>
          <SelectValue placeholder="Select candidate" />
        </SelectTrigger>
        <SelectContent>
          {promotableCandidates.map((candidate) => (
            <SelectItem key={candidate.candidateId} value={candidate.candidateId}>
              {candidate.candidateLabel || candidate.candidateKey} • {candidate.candidateStatus}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={promotingDiscoveredCandidate || !promotionCandidateId}
        onClick={() => void promoteDiscoveredCandidate(promotionCandidateId)}
      >
        {promotingDiscoveredCandidate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Promote candidate
      </Button>

      <Label className="pt-1 text-xs">Record policy ratification</Label>
      <Input
        value={ratificationDraft.policyKey}
        onChange={(event) => setRatificationDraft((current) => ({ ...current, policyKey: event.target.value }))}
        placeholder="Policy key"
      />
      <Input
        value={ratificationDraft.signerKey}
        onChange={(event) => setRatificationDraft((current) => ({ ...current, signerKey: event.target.value }))}
        placeholder="Signer key"
      />
      <Select
        value={ratificationDraft.ratificationDecision}
        onValueChange={(value) => setRatificationDraft((current) => ({ ...current, ratificationDecision: value as typeof current.ratificationDecision }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Ratification decision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="approve">Approve</SelectItem>
          <SelectItem value="reject">Reject</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={ratificationDraft.ratificationSignature}
        onChange={(event) => setRatificationDraft((current) => ({ ...current, ratificationSignature: event.target.value }))}
        placeholder="Ratification signature"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={savingPolicyRatification || !ratificationDraft.signerKey.trim() || !ratificationDraft.ratificationSignature.trim()}
        onClick={() => void recordPolicyRatification(ratificationDraft)}
      >
        {savingPolicyRatification ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save policy ratification
      </Button>
    </>
  );
}
