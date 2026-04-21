import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type {
  GuardianExternalSignerRow,
  GuardianMultisigPolicyRow,
} from '@/lib/governance-guardian-multisig';

interface GovernanceGuardianMultisigCardProps {
  loading: boolean;
  backendUnavailable: boolean;
  savingPolicy: boolean;
  addingSigner: boolean;
  togglingSignerId: string | null;
  policy: GuardianMultisigPolicyRow | null;
  signers: GuardianExternalSignerRow[];
  activeSignerCount: number;
  formatTimestamp: (value: string | null) => string;
  onRefresh: () => void;
  onSavePolicy: (draft: {
    isEnabled: boolean;
    requiredExternalApprovals: number;
    network: string;
    contractReference: string;
    notes: string;
  }) => void;
  onAddSigner: (draft: {
    signerKey: string;
    signerLabel: string;
    keyAlgorithm: string;
    custodyProvider: string;
  }) => void;
  onSetSignerActive: (signerId: string, isActive: boolean) => void;
}

export function GovernanceGuardianMultisigCard({
  loading,
  backendUnavailable,
  savingPolicy,
  addingSigner,
  togglingSignerId,
  policy,
  signers,
  activeSignerCount,
  formatTimestamp,
  onRefresh,
  onSavePolicy,
  onAddSigner,
  onSetSignerActive,
}: GovernanceGuardianMultisigCardProps) {
  const [policyDraft, setPolicyDraft] = useState({
    isEnabled: Boolean(policy?.is_enabled),
    requiredExternalApprovals: Math.max(1, policy?.required_external_approvals || 1),
    network: policy?.network || '',
    contractReference: policy?.contract_reference || '',
    notes: policy?.notes || '',
  });
  const [signerDraft, setSignerDraft] = useState({
    signerKey: '',
    signerLabel: '',
    keyAlgorithm: 'ECDSA_P256_SHA256_V1',
    custodyProvider: '',
  });

  useEffect(() => {
    setPolicyDraft({
      isEnabled: Boolean(policy?.is_enabled),
      requiredExternalApprovals: Math.max(1, policy?.required_external_approvals || 1),
      network: policy?.network || '',
      contractReference: policy?.contract_reference || '',
      notes: policy?.notes || '',
    });
  }, [policy?.contract_reference, policy?.is_enabled, policy?.network, policy?.notes, policy?.required_external_approvals]);

  const canSavePolicy = useMemo(
    () => policyDraft.requiredExternalApprovals >= 1,
    [policyDraft.requiredExternalApprovals],
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Guardian Multisig</h2>
          <p className="text-sm text-muted-foreground">
            Manage external guardian signer registry and multisig policy enforcement.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={loading || backendUnavailable}
          onClick={onRefresh}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {backendUnavailable ? (
        <p className="mt-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Guardian multisig infrastructure is not available in this environment yet.
        </p>
      ) : loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading guardian multisig policy...
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">External multisig policy</p>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Active signers {activeSignerCount}
              </Badge>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="guardian-multisig-enabled">Require external multisig</Label>
                  <Switch
                    id="guardian-multisig-enabled"
                    checked={policyDraft.isEnabled}
                    onCheckedChange={(checked) =>
                      setPolicyDraft((current) => ({
                        ...current,
                        isEnabled: checked,
                      }))
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enforces external signer attestations for guardian-threshold proposals.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardian-multisig-required">Required external approvals</Label>
                <Input
                  id="guardian-multisig-required"
                  type="number"
                  min={1}
                  step={1}
                  value={policyDraft.requiredExternalApprovals}
                  onChange={(event) =>
                    setPolicyDraft((current) => ({
                      ...current,
                      requiredExternalApprovals: Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardian-multisig-network">Network</Label>
                <Input
                  id="guardian-multisig-network"
                  value={policyDraft.network}
                  onChange={(event) => setPolicyDraft((current) => ({ ...current, network: event.target.value }))}
                  placeholder="ethereum-mainnet"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardian-multisig-contract">Contract reference</Label>
                <Input
                  id="guardian-multisig-contract"
                  value={policyDraft.contractReference}
                  onChange={(event) => setPolicyDraft((current) => ({ ...current, contractReference: event.target.value }))}
                  placeholder="safe://chain/0x..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="guardian-multisig-notes">Notes</Label>
                <Textarea
                  id="guardian-multisig-notes"
                  value={policyDraft.notes}
                  onChange={(event) => setPolicyDraft((current) => ({ ...current, notes: event.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!canSavePolicy || savingPolicy}
                onClick={() => onSavePolicy(policyDraft)}
              >
                {savingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save policy
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Add external signer</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="guardian-signer-key">Signer key</Label>
                <Input
                  id="guardian-signer-key"
                  value={signerDraft.signerKey}
                  onChange={(event) => setSignerDraft((current) => ({ ...current, signerKey: event.target.value }))}
                  placeholder="public key / wallet address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian-signer-label">Label</Label>
                <Input
                  id="guardian-signer-label"
                  value={signerDraft.signerLabel}
                  onChange={(event) => setSignerDraft((current) => ({ ...current, signerLabel: event.target.value }))}
                  placeholder="Guardian 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian-signer-algo">Key algorithm</Label>
                <Input
                  id="guardian-signer-algo"
                  value={signerDraft.keyAlgorithm}
                  onChange={(event) => setSignerDraft((current) => ({ ...current, keyAlgorithm: event.target.value }))}
                  placeholder="ECDSA_P256_SHA256_V1"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="guardian-signer-custody">Custody provider</Label>
                <Input
                  id="guardian-signer-custody"
                  value={signerDraft.custodyProvider}
                  onChange={(event) => setSignerDraft((current) => ({ ...current, custodyProvider: event.target.value }))}
                  placeholder="Safe / Fireblocks / Local HSM"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={addingSigner || !signerDraft.signerKey.trim()}
                onClick={() => {
                  onAddSigner(signerDraft);
                  setSignerDraft((current) => ({ ...current, signerKey: '', signerLabel: '' }));
                }}
              >
                {addingSigner ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add signer
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {signers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No external guardian signers registered yet.</p>
            ) : (
              signers.map((signer) => (
                <div key={signer.id} className="rounded-lg border border-border/60 bg-card p-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{signer.signer_label || signer.signer_key}</p>
                      <p className="text-muted-foreground">{signer.key_algorithm}{signer.custody_provider ? ` • ${signer.custody_provider}` : ''}</p>
                      <p className="text-muted-foreground">Added {formatTimestamp(signer.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={signer.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'}>
                        {signer.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={togglingSignerId === signer.id}
                        onClick={() => onSetSignerActive(signer.id, !signer.is_active)}
                      >
                        {togglingSignerId === signer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : signer.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
