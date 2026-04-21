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
import { GovernancePublicAuditVerifierMirrorSection } from '@/components/governance/GovernancePublicAuditVerifierMirrorSection';
import { GovernancePublicAuditVerifierMirrorProductionSection } from '@/components/governance/GovernancePublicAuditVerifierMirrorProductionSection';
import { useGovernancePublicAuditVerifiers } from '@/lib/use-governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierPanelProps {
  latestBatchId: string | null;
  formatTimestamp: (value: string | null) => string;
}

export function GovernancePublicAuditVerifierPanel({
  latestBatchId,
  formatTimestamp,
}: GovernancePublicAuditVerifierPanelProps) {
  const {
    loadingVerifierData,
    verifierBackendUnavailable,
    refreshingVerifierData,
    addingVerifierNode,
    recordingBatchVerification,
    recordingNetworkProof,
    togglingVerifierId,
    replicationPolicy,
    verifierNodes,
    batchVerifications,
    networkProofs,
    verifierSummary,
    refreshVerifierData,
    registerVerifierNode,
    setVerifierNodeActive,
    recordBatchVerification,
    recordNetworkProof,
  } = useGovernancePublicAuditVerifiers({ latestBatchId });

  const [verifierDraft, setVerifierDraft] = useState({
    verifierKey: '',
    verifierLabel: '',
    endpointUrl: '',
    keyAlgorithm: 'ECDSA_P256_SHA256_V1',
  });
  const [verificationDraft, setVerificationDraft] = useState({
    verifierId: '',
    status: 'verified' as 'verified' | 'mismatch' | 'unreachable',
    verificationHash: '',
    proofReference: '',
  });
  const [proofDraft, setProofDraft] = useState({
    network: '',
    reference: '',
    blockHeight: '',
  });

  const latestVerificationByVerifierId = useMemo(
    () =>
      batchVerifications.reduce<Record<string, (typeof batchVerifications)[number]>>((accumulator, verification) => {
        if (!accumulator[verification.verifier_id]) {
          accumulator[verification.verifier_id] = verification;
        }
        return accumulator;
      }, {}),
    [batchVerifications],
  );

  if (verifierBackendUnavailable) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground">
          Replicated verifier infrastructure is not available in this environment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Replicated verifiers</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loadingVerifierData || refreshingVerifierData}
          onClick={() => void refreshVerifierData()}
        >
          {loadingVerifierData || refreshingVerifierData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh verifiers
        </Button>
      </div>

      {latestBatchId ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className={verifierSummary?.meetsReplicationThreshold ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}>
            {verifierSummary?.meetsReplicationThreshold ? 'Replication threshold met' : 'Replication threshold pending'}
          </Badge>
          {verifierSummary && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Verified {verifierSummary.verifiedCount}/{verifierSummary.requiredVerifiedCount}
            </Badge>
          )}
          {verifierSummary && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Network proofs {verifierSummary.networkProofCount}/{verifierSummary.requiredNetworkProofCount}
            </Badge>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Capture a batch first to record verifier results and network proofs.</p>
      )}

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Verifier node registry</p>
          <Input
            value={verifierDraft.verifierKey}
            onChange={(event) => setVerifierDraft((current) => ({ ...current, verifierKey: event.target.value }))}
            placeholder="Verifier key"
          />
          <Input
            value={verifierDraft.verifierLabel}
            onChange={(event) => setVerifierDraft((current) => ({ ...current, verifierLabel: event.target.value }))}
            placeholder="Verifier label"
          />
          <Input
            value={verifierDraft.endpointUrl}
            onChange={(event) => setVerifierDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
            placeholder="Verifier endpoint URL"
          />
          <Input
            value={verifierDraft.keyAlgorithm}
            onChange={(event) => setVerifierDraft((current) => ({ ...current, keyAlgorithm: event.target.value }))}
            placeholder="Key algorithm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={addingVerifierNode || !verifierDraft.verifierKey.trim()}
            onClick={() => void registerVerifierNode(verifierDraft)}
          >
            {addingVerifierNode ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Register verifier
          </Button>

          <div className="space-y-2">
            {verifierNodes.map((verifier) => {
              const latestVerification = latestVerificationByVerifierId[verifier.id];

              return (
                <div key={verifier.id} className="rounded-md border border-border/60 bg-card p-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{verifier.verifier_label || verifier.verifier_key}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={verifier.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'}>
                        {verifier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={togglingVerifierId === verifier.id}
                        onClick={() => void setVerifierNodeActive(verifier.id, !verifier.is_active)}
                      >
                        {togglingVerifierId === verifier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : verifier.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>

                  {latestVerification && (
                    <p className="mt-1 text-muted-foreground">
                      Latest: {latestVerification.status} ({formatTimestamp(latestVerification.verified_at)})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Batch verification + proof</p>

          <Label className="text-xs">Verifier result</Label>
          <Select
            value={verificationDraft.verifierId}
            onValueChange={(value) => setVerificationDraft((current) => ({ ...current, verifierId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select verifier" />
            </SelectTrigger>
            <SelectContent>
              {verifierNodes.filter((node) => node.is_active).map((node) => (
                <SelectItem key={node.id} value={node.id}>{node.verifier_label || node.verifier_key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={verificationDraft.status}
            onValueChange={(value) => setVerificationDraft((current) => ({ ...current, status: value as typeof verificationDraft.status }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Verification status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="mismatch">Mismatch</SelectItem>
              <SelectItem value="unreachable">Unreachable</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={verificationDraft.verificationHash}
            onChange={(event) => setVerificationDraft((current) => ({ ...current, verificationHash: event.target.value }))}
            placeholder="Verification hash (optional)"
          />
          <Input
            value={verificationDraft.proofReference}
            onChange={(event) => setVerificationDraft((current) => ({ ...current, proofReference: event.target.value }))}
            placeholder="Verifier proof reference (optional)"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={!latestBatchId || recordingBatchVerification}
            onClick={() => void recordBatchVerification(verificationDraft)}
          >
            {recordingBatchVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record verifier result
          </Button>

          <Label className="mt-2 text-xs">Network proof</Label>
          <Input
            value={proofDraft.network}
            onChange={(event) => setProofDraft((current) => ({ ...current, network: event.target.value }))}
            placeholder="Network"
          />
          <Input
            value={proofDraft.reference}
            onChange={(event) => setProofDraft((current) => ({ ...current, reference: event.target.value }))}
            placeholder="Proof reference"
          />
          <Input
            value={proofDraft.blockHeight}
            onChange={(event) => setProofDraft((current) => ({ ...current, blockHeight: event.target.value }))}
            placeholder="Block height (optional)"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={!latestBatchId || recordingNetworkProof}
            onClick={() => void recordNetworkProof(proofDraft)}
          >
            {recordingNetworkProof ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record network proof
          </Button>

          {networkProofs.length > 0 && (
            <div className="space-y-1 pt-1 text-xs text-muted-foreground">
              {networkProofs.slice(0, 4).map((proof) => (
                <p key={proof.id}>
                  {proof.network}: <span className="text-foreground">{proof.proof_reference}</span>
                </p>
              ))}
            </div>
          )}

          {replicationPolicy && (
            <p className="text-xs text-muted-foreground">
              Policy: {replicationPolicy.policy_name}
            </p>
          )}
        </div>
      </div>

      <GovernancePublicAuditVerifierMirrorSection
        latestBatchId={latestBatchId}
        formatTimestamp={formatTimestamp}
      />
      <GovernancePublicAuditVerifierMirrorProductionSection
        latestBatchId={latestBatchId}
        formatTimestamp={formatTimestamp}
      />
    </div>
  );
}
