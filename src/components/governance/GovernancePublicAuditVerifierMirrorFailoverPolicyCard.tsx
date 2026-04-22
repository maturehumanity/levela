import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GovernancePublicAuditVerifierMirrorFailoverPolicySummary } from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFailoverPolicyDraft {
  minHealthyMirrors: string;
  maxMirrorLatencyMs: string;
  maxFailuresBeforeCooldown: string;
  cooldownMinutes: string;
  preferSameRegion: boolean;
  requiredDistinctRegions: string;
  requiredDistinctOperators: string;
  mirrorSelectionStrategy: string;
  maxMirrorCandidates: string;
  minIndependentDirectorySigners: string;
  requirePolicyRatification: boolean;
  minPolicyRatificationApprovals: string;
  requireSignerGovernanceApproval: boolean;
  minSignerGovernanceIndependentApprovals: string;
  requireFederationOpsReadiness: boolean;
  maxOpenCriticalFederationAlerts: string;
  minOnboardedFederationOperators: string;
}

interface GovernancePublicAuditVerifierMirrorFailoverPolicyCardProps {
  canManageMirrorProduction: boolean;
  savingFailoverPolicy: boolean;
  failoverPolicy: GovernancePublicAuditVerifierMirrorFailoverPolicySummary | null;
  formatTimestamp: (value: string | null) => string;
  saveFailoverPolicy: (draft: GovernancePublicAuditVerifierMirrorFailoverPolicyDraft) => Promise<void> | void;
}

const DEFAULT_DRAFT: GovernancePublicAuditVerifierMirrorFailoverPolicyDraft = {
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
  requireSignerGovernanceApproval: false,
  minSignerGovernanceIndependentApprovals: '1',
  requireFederationOpsReadiness: false,
  maxOpenCriticalFederationAlerts: '0',
  minOnboardedFederationOperators: '1',
};

export function GovernancePublicAuditVerifierMirrorFailoverPolicyCard({
  canManageMirrorProduction,
  savingFailoverPolicy,
  failoverPolicy,
  formatTimestamp,
  saveFailoverPolicy,
}: GovernancePublicAuditVerifierMirrorFailoverPolicyCardProps) {
  const [failoverDraft, setFailoverDraft] = useState(DEFAULT_DRAFT);

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
      requireSignerGovernanceApproval: failoverPolicy.requireSignerGovernanceApproval,
      minSignerGovernanceIndependentApprovals: String(failoverPolicy.minSignerGovernanceIndependentApprovals),
      requireFederationOpsReadiness: failoverPolicy.requireFederationOpsReadiness,
      maxOpenCriticalFederationAlerts: String(failoverPolicy.maxOpenCriticalFederationAlerts),
      minOnboardedFederationOperators: String(failoverPolicy.minOnboardedFederationOperators),
    });
  }, [failoverPolicy]);

  return (
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
        value={failoverDraft.minSignerGovernanceIndependentApprovals}
        onChange={(event) => setFailoverDraft((current) => ({ ...current, minSignerGovernanceIndependentApprovals: event.target.value }))}
        placeholder="Min signer governance approvals"
        disabled={!canManageMirrorProduction}
      />
      <Input
        value={failoverDraft.maxOpenCriticalFederationAlerts}
        onChange={(event) => setFailoverDraft((current) => ({ ...current, maxOpenCriticalFederationAlerts: event.target.value }))}
        placeholder="Max open critical federation alerts"
        disabled={!canManageMirrorProduction}
      />
      <Input
        value={failoverDraft.minOnboardedFederationOperators}
        onChange={(event) => setFailoverDraft((current) => ({ ...current, minOnboardedFederationOperators: event.target.value }))}
        placeholder="Min onboarded federation operators"
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
      <Select
        value={failoverDraft.requireSignerGovernanceApproval ? 'yes' : 'no'}
        onValueChange={(value) => setFailoverDraft((current) => ({ ...current, requireSignerGovernanceApproval: value === 'yes' }))}
        disabled={!canManageMirrorProduction}
      >
        <SelectTrigger>
          <SelectValue placeholder="Require signer governance" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Require signer governance</SelectItem>
          <SelectItem value="no">Allow without signer governance</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={failoverDraft.requireFederationOpsReadiness ? 'yes' : 'no'}
        onValueChange={(value) => setFailoverDraft((current) => ({ ...current, requireFederationOpsReadiness: value === 'yes' }))}
        disabled={!canManageMirrorProduction}
      >
        <SelectTrigger>
          <SelectValue placeholder="Require federation ops readiness" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Require federation ops readiness</SelectItem>
          <SelectItem value="no">Allow without federation ops gate</SelectItem>
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
  );
}
