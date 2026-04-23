import { useEffect, useMemo, useState } from 'react';
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
import {
  formatGovernancePublicAuditVerifierMirrorSignerGovernanceStatusLabel,
  type GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow,
  type GovernancePublicAuditVerifierMirrorSignerGovernanceSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorSignerGovernanceControlsProps {
  canManageSignerGovernance: boolean;
  savingSignerGovernanceRequirement: boolean;
  savingSignerGovernanceAttestation: boolean;
  signerGovernanceSummary: GovernancePublicAuditVerifierMirrorSignerGovernanceSummary | null;
  signerGovernanceBoard: GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow[];
  saveSignerGovernanceRequirement: (draft: {
    requireSignerGovernanceApproval: boolean;
    minSignerGovernanceIndependentApprovals: string;
  }) => Promise<void> | void;
  saveSignerGovernanceAttestation: (draft: {
    targetSignerId: string;
    attestorSignerKey: string;
    attestationDecision: 'approve' | 'reject';
    attestationSignature: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierMirrorSignerGovernanceControls({
  canManageSignerGovernance,
  savingSignerGovernanceRequirement,
  savingSignerGovernanceAttestation,
  signerGovernanceSummary,
  signerGovernanceBoard,
  saveSignerGovernanceRequirement,
  saveSignerGovernanceAttestation,
}: GovernancePublicAuditVerifierMirrorSignerGovernanceControlsProps) {
  const [requirementDraft, setRequirementDraft] = useState({
    requireSignerGovernanceApproval: false,
    minSignerGovernanceIndependentApprovals: '1',
  });
  const [attestationDraft, setAttestationDraft] = useState({
    targetSignerId: '',
    attestorSignerKey: '',
    attestationDecision: 'approve' as 'approve' | 'reject',
    attestationSignature: '',
  });

  const attestationTargets = useMemo(
    () => signerGovernanceBoard.filter((signer) => signer.isActive && signer.governanceStatus !== 'approved'),
    [signerGovernanceBoard],
  );

  const requirementMinApprovals = signerGovernanceSummary?.minSignerGovernanceIndependentApprovals;
  const requirementEnabled = signerGovernanceSummary?.requireSignerGovernanceApproval;

  useEffect(() => {
    if (!signerGovernanceSummary) return;
    setRequirementDraft({
      requireSignerGovernanceApproval: signerGovernanceSummary.requireSignerGovernanceApproval,
      minSignerGovernanceIndependentApprovals: String(signerGovernanceSummary.minSignerGovernanceIndependentApprovals),
    });
  }, [signerGovernanceSummary]);

  return (
    <>
      {canManageSignerGovernance && (
        <>
          <Label className="pt-1 text-xs">Signer governance requirement</Label>
          <Select
            value={requirementDraft.requireSignerGovernanceApproval ? 'yes' : 'no'}
            onValueChange={(value) => setRequirementDraft((current) => ({
              ...current,
              requireSignerGovernanceApproval: value === 'yes',
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Require signer governance approvals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Require governance approvals</SelectItem>
              <SelectItem value="no">Allow without governance approvals</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={requirementDraft.minSignerGovernanceIndependentApprovals}
            onChange={(event) => setRequirementDraft((current) => ({
              ...current,
              minSignerGovernanceIndependentApprovals: event.target.value,
            }))}
            placeholder="Min independent signer approvals"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={savingSignerGovernanceRequirement}
            onClick={() => void saveSignerGovernanceRequirement(requirementDraft)}
          >
            {savingSignerGovernanceRequirement ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save signer governance requirement
          </Button>
        </>
      )}

      {(typeof requirementEnabled === 'boolean' || typeof requirementMinApprovals === 'number') && (
        <p className="text-muted-foreground">
          Requirement {requirementEnabled ? 'Enabled' : 'Disabled'} • Min independent approvals {requirementMinApprovals ?? 1}
        </p>
      )}

      {canManageSignerGovernance && (
        <>
          <Label className="pt-1 text-xs">Record signer governance attestation</Label>
          <Select
            value={attestationDraft.targetSignerId}
            onValueChange={(value) => setAttestationDraft((current) => ({ ...current, targetSignerId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select target signer" />
            </SelectTrigger>
            <SelectContent>
              {attestationTargets.map((signer) => (
                <SelectItem key={signer.signerId} value={signer.signerId}>
                  {signer.signerLabel || signer.signerKey}
                  {' '}• {formatGovernancePublicAuditVerifierMirrorSignerGovernanceStatusLabel(signer.governanceStatus)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={attestationDraft.attestorSignerKey}
            onChange={(event) => setAttestationDraft((current) => ({ ...current, attestorSignerKey: event.target.value }))}
            placeholder="Attestor signer key"
          />
          <Select
            value={attestationDraft.attestationDecision}
            onValueChange={(value) => setAttestationDraft((current) => ({
              ...current,
              attestationDecision: value as typeof current.attestationDecision,
            }))}
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
            disabled={savingSignerGovernanceAttestation || !attestationDraft.targetSignerId || !attestationDraft.attestorSignerKey.trim() || !attestationDraft.attestationSignature.trim()}
            onClick={() => void saveSignerGovernanceAttestation(attestationDraft)}
          >
            {savingSignerGovernanceAttestation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save signer governance attestation
          </Button>
        </>
      )}
    </>
  );
}
