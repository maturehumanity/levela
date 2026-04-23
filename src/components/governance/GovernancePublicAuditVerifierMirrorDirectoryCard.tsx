import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
import {
  formatGovernancePublicAuditVerifierMirrorTrustTierLabel,
  type GovernancePublicAuditVerifierMirrorDirectorySummaryRow,
  type GovernancePublicAuditVerifierMirrorDirectoryTrustSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorDirectoryCardProps {
  canManageMirrorProduction: boolean;
  registeringDirectorySigner: boolean;
  publishingSignedDirectory: boolean;
  savingDirectoryAttestation: boolean;
  directorySummaries: GovernancePublicAuditVerifierMirrorDirectorySummaryRow[];
  directoryTrustSummary: GovernancePublicAuditVerifierMirrorDirectoryTrustSummary | null;
  formatTimestamp: (value: string | null) => string;
  registerDirectorySigner: (draft: {
    signerKey: string;
    signerLabel: string;
    publicKey: string;
    signingAlgorithm: string;
    trustTier: string;
  }) => Promise<void> | void;
  publishSignedDirectory: (draft: {
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
  }) => Promise<void> | void;
  recordDirectoryAttestation: (draft: {
    directoryId: string;
    signerKey: string;
    attestationDecision: 'approve' | 'reject';
    attestationSignature: string;
  }) => Promise<void> | void;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function GovernancePublicAuditVerifierMirrorDirectoryCard({
  canManageMirrorProduction,
  registeringDirectorySigner,
  publishingSignedDirectory,
  savingDirectoryAttestation,
  directorySummaries,
  directoryTrustSummary,
  formatTimestamp,
  registerDirectorySigner,
  publishSignedDirectory,
  recordDirectoryAttestation,
}: GovernancePublicAuditVerifierMirrorDirectoryCardProps) {
  const [signerDraft, setSignerDraft] = useState({
    signerKey: '',
    signerLabel: '',
    publicKey: '',
    signingAlgorithm: 'ed25519',
    trustTier: 'observer',
  });

  const [publishDraft, setPublishDraft] = useState({
    signerKey: '',
    signature: '',
    signatureAlgorithm: 'ed25519',
  });

  const [attestationDraft, setAttestationDraft] = useState({
    directoryId: '',
    signerKey: '',
    attestationDecision: 'approve' as 'approve' | 'reject',
    attestationSignature: '',
  });

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
      <p className="font-medium text-foreground">Signed mirror directory</p>
      {canManageMirrorProduction && (
        <>
          <Label className="text-xs">Register signer</Label>
          <Input
            value={signerDraft.signerKey}
            onChange={(event) => setSignerDraft((current) => ({ ...current, signerKey: event.target.value }))}
            placeholder="Signer key"
          />
          <Input
            value={signerDraft.signerLabel}
            onChange={(event) => setSignerDraft((current) => ({ ...current, signerLabel: event.target.value }))}
            placeholder="Signer label"
          />
          <Input
            value={signerDraft.publicKey}
            onChange={(event) => setSignerDraft((current) => ({ ...current, publicKey: event.target.value }))}
            placeholder="Public key"
          />
          <Input
            value={signerDraft.signingAlgorithm}
            onChange={(event) => setSignerDraft((current) => ({ ...current, signingAlgorithm: event.target.value }))}
            placeholder="Signing algorithm"
          />
          <Select
            value={signerDraft.trustTier}
            onValueChange={(value) => setSignerDraft((current) => ({ ...current, trustTier: value }))}
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
            disabled={registeringDirectorySigner || !signerDraft.signerKey.trim() || !signerDraft.publicKey.trim()}
            onClick={() => void registerDirectorySigner(signerDraft)}
          >
            {registeringDirectorySigner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save signer
          </Button>

          <Label className="pt-1 text-xs">Publish signed directory</Label>
          <Input
            value={publishDraft.signerKey}
            onChange={(event) => setPublishDraft((current) => ({ ...current, signerKey: event.target.value }))}
            placeholder="Signer key"
          />
          <Input
            value={publishDraft.signature}
            onChange={(event) => setPublishDraft((current) => ({ ...current, signature: event.target.value }))}
            placeholder="Directory signature"
          />
          <Input
            value={publishDraft.signatureAlgorithm}
            onChange={(event) => setPublishDraft((current) => ({ ...current, signatureAlgorithm: event.target.value }))}
            placeholder="Signature algorithm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={publishingSignedDirectory || !publishDraft.signerKey.trim() || !publishDraft.signature.trim()}
            onClick={() => void publishSignedDirectory(publishDraft)}
          >
            {publishingSignedDirectory ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publish directory
          </Button>

          <Label className="pt-1 text-xs">Record directory attestation</Label>
          <Select
            value={attestationDraft.directoryId}
            onValueChange={(value) => setAttestationDraft((current) => ({ ...current, directoryId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select directory" />
            </SelectTrigger>
            <SelectContent>
              {directorySummaries.slice(0, 12).map((directory) => (
                <SelectItem key={directory.directoryId} value={directory.directoryId}>
                  {previewHash(directory.directoryHash)} • {formatTimestamp(directory.publishedAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={attestationDraft.signerKey}
            onChange={(event) => setAttestationDraft((current) => ({ ...current, signerKey: event.target.value }))}
            placeholder="Signer key"
          />
          <Select
            value={attestationDraft.attestationDecision}
            onValueChange={(value) => setAttestationDraft((current) => ({ ...current, attestationDecision: value as typeof current.attestationDecision }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Attestation decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={attestationDraft.attestationSignature}
            onChange={(event) => setAttestationDraft((current) => ({ ...current, attestationSignature: event.target.value }))}
            placeholder="Attestation signature"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={
              savingDirectoryAttestation
              || !attestationDraft.directoryId
              || !attestationDraft.signerKey.trim()
              || !attestationDraft.attestationSignature.trim()
            }
            onClick={() => void recordDirectoryAttestation(attestationDraft)}
          >
            {savingDirectoryAttestation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save attestation
          </Button>
        </>
      )}

      <div className="space-y-2">
        {directorySummaries.slice(0, 4).map((directory) => (
          <div key={directory.directoryId} className="rounded-md border border-border/60 bg-background p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{directory.signerLabel || directory.signerKey}</p>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                {formatGovernancePublicAuditVerifierMirrorTrustTierLabel(directory.trustTier)}
              </Badge>
            </div>
            <p className="text-muted-foreground">{previewHash(directory.directoryHash)}</p>
            <p className="text-muted-foreground">{directory.signatureAlgorithm}</p>
            <p className="text-muted-foreground">{formatTimestamp(directory.publishedAt)}</p>
          </div>
        ))}
      </div>

      {directoryTrustSummary && (
        <p className="text-muted-foreground">
          Approvals {directoryTrustSummary.approvalCount} • Independent {directoryTrustSummary.independentApprovalCount}/{directoryTrustSummary.requiredIndependentSigners}
        </p>
      )}
    </div>
  );
}
