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
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/integrations/supabase/types';
import type {
  GovernanceProposalExternalMultisigSummary,
  GuardianExternalSignerRow,
} from '@/lib/governance-guardian-multisig';

interface GovernanceGuardianExternalMultisigPanelProps {
  loadingExternalMultisig: boolean;
  externalProgressLabel: string;
  externalSummary: GovernanceProposalExternalMultisigSummary | null;
  canAttestExternalSignatures: boolean;
  selectedExternalSignerId: string;
  externalSigners: GuardianExternalSignerRow[];
  externalDecision: Database['public']['Enums']['governance_guardian_decision'];
  externalSignatureReference: string;
  externalSignedMessage: string;
  externalSignature: string;
  externalPayloadHash: string;
  externalRationale: string;
  submittingExternalSignature: boolean;
  isBlocked: boolean;
  onSelectedExternalSignerIdChange: (next: string) => void;
  onExternalDecisionChange: (next: Database['public']['Enums']['governance_guardian_decision']) => void;
  onExternalSignatureReferenceChange: (next: string) => void;
  onExternalSignedMessageChange: (next: string) => void;
  onExternalSignatureChange: (next: string) => void;
  onExternalPayloadHashChange: (next: string) => void;
  onExternalRationaleChange: (next: string) => void;
  onRecordExternalSignature: () => void;
}

export function GovernanceGuardianExternalMultisigPanel({
  loadingExternalMultisig,
  externalProgressLabel,
  externalSummary,
  canAttestExternalSignatures,
  selectedExternalSignerId,
  externalSigners,
  externalDecision,
  externalSignatureReference,
  externalSignedMessage,
  externalSignature,
  externalPayloadHash,
  externalRationale,
  submittingExternalSignature,
  isBlocked,
  onSelectedExternalSignerIdChange,
  onExternalDecisionChange,
  onExternalSignatureReferenceChange,
  onExternalSignedMessageChange,
  onExternalSignatureChange,
  onExternalPayloadHashChange,
  onExternalRationaleChange,
  onRecordExternalSignature,
}: GovernanceGuardianExternalMultisigPanelProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/50 bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">External Multisig</p>
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {loadingExternalMultisig ? 'Loading...' : externalProgressLabel}
        </Badge>
      </div>

      {!loadingExternalMultisig && externalSummary && (
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <p>
            Required external approvals:
            {' '}
            <span className="text-foreground">{externalSummary.requiredExternalApprovals}</span>
          </p>
          <p>
            Active external signers:
            {' '}
            <span className="text-foreground">{externalSummary.activeExternalSignerCount}</span>
          </p>
          {externalSummary.policyNetwork && (
            <p>
              Network:
              {' '}
              <span className="text-foreground">{externalSummary.policyNetwork}</span>
            </p>
          )}
          {externalSummary.policyContractReference && (
            <p>
              Contract:
              {' '}
              <span className="text-foreground">{externalSummary.policyContractReference}</span>
            </p>
          )}
        </div>
      )}

      {canAttestExternalSignatures && !loadingExternalMultisig && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">External signer</Label>
            <Select value={selectedExternalSignerId} onValueChange={onSelectedExternalSignerIdChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select external signer" />
              </SelectTrigger>
              <SelectContent>
                {externalSigners.map((signer) => (
                  <SelectItem key={signer.id} value={signer.id}>
                    {(signer.signer_label || signer.signer_key).slice(0, 72)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Decision</Label>
            <Select value={externalDecision} onValueChange={onExternalDecisionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select decision" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Signature reference</Label>
            <Input
              value={externalSignatureReference}
              onChange={(event) => onExternalSignatureReferenceChange(event.target.value)}
              placeholder="tx hash / relay id / verifier receipt"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Signed message (optional, for cryptographic verification)</Label>
            <Textarea
              value={externalSignedMessage}
              onChange={(event) => onExternalSignedMessageChange(event.target.value)}
              rows={2}
              placeholder="Canonical message signed by the external signer"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Signature (optional, base64url)</Label>
            <Input
              value={externalSignature}
              onChange={(event) => onExternalSignatureChange(event.target.value)}
              placeholder="signature blob"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payload hash (optional)</Label>
            <Input
              value={externalPayloadHash}
              onChange={(event) => onExternalPayloadHashChange(event.target.value)}
              placeholder="hash of signed guardian payload"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Rationale (optional)</Label>
            <Textarea
              value={externalRationale}
              onChange={(event) => onExternalRationaleChange(event.target.value)}
              rows={2}
              placeholder="attestation notes"
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={isBlocked || submittingExternalSignature || externalSigners.length === 0}
            onClick={onRecordExternalSignature}
          >
            {submittingExternalSignature ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record external signature
          </Button>
        </div>
      )}
    </div>
  );
}
