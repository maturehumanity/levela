import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { GovernancePublicAuditVerifierMirrorProbeJobsCard } from '@/components/governance/GovernancePublicAuditVerifierMirrorProbeJobsCard';
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
import { useGovernancePublicAuditVerifierMirrorProduction } from '@/lib/use-governance-public-audit-verifier-mirror-production';

interface GovernancePublicAuditVerifierMirrorProductionSectionProps {
  latestBatchId: string | null;
  formatTimestamp: (value: string | null) => string;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function GovernancePublicAuditVerifierMirrorProductionSection({
  latestBatchId,
  formatTimestamp,
}: GovernancePublicAuditVerifierMirrorProductionSectionProps) {
  const {
    loadingProductionData,
    productionBackendUnavailable,
    canManageMirrorProduction,
    savingFailoverPolicy,
    registeringDirectorySigner,
    publishingSignedDirectory,
    schedulingProbeJobs,
    completingProbeJob,
    failoverPolicy,
    directorySummaries,
    probeJobSummary,
    probeJobs,
    loadProductionData,
    saveFailoverPolicy,
    registerDirectorySigner,
    publishSignedDirectory,
    scheduleProbeJobs,
    completeProbeJob,
  } = useGovernancePublicAuditVerifierMirrorProduction({ latestBatchId });

  const [failoverDraft, setFailoverDraft] = useState({
    minHealthyMirrors: '1',
    maxMirrorLatencyMs: '2500',
    maxFailuresBeforeCooldown: '2',
    cooldownMinutes: '10',
    preferSameRegion: false,
    requiredDistinctRegions: '1',
    requiredDistinctOperators: '1',
    mirrorSelectionStrategy: 'health_latency_diversity',
    maxMirrorCandidates: '8',
  });

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
    });
  }, [failoverPolicy]);

  if (productionBackendUnavailable) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Mirror production rollout</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={loadingProductionData}
          onClick={() => void loadProductionData()}
        >
          {loadingProductionData ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh rollout
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {probeJobSummary && (
          <Badge
            variant="outline"
            className={probeJobSummary.pendingSlaMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'}
          >
            Probe SLA {probeJobSummary.pendingSlaMet ? 'met' : 'breached'}
          </Badge>
        )}
        {probeJobSummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Pending {probeJobSummary.pendingCount + probeJobSummary.runningCount}
          </Badge>
        )}
        {failoverPolicy && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Min healthy mirrors {failoverPolicy.minHealthyMirrors}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
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
            </>
          )}

          <div className="space-y-2">
            {directorySummaries.slice(0, 4).map((directory) => (
              <div key={directory.directoryId} className="rounded-md border border-border/60 bg-background p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{directory.signerLabel || directory.signerKey}</p>
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    {directory.trustTier}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{previewHash(directory.directoryHash)}</p>
                <p className="text-muted-foreground">{directory.signatureAlgorithm}</p>
                <p className="text-muted-foreground">{formatTimestamp(directory.publishedAt)}</p>
              </div>
            ))}
          </div>
        </div>

        <GovernancePublicAuditVerifierMirrorProbeJobsCard
          canManageMirrorProduction={canManageMirrorProduction}
          schedulingProbeJobs={schedulingProbeJobs}
          completingProbeJob={completingProbeJob}
          probeJobSummary={probeJobSummary}
          probeJobs={probeJobs}
          formatTimestamp={formatTimestamp}
          scheduleProbeJobs={scheduleProbeJobs}
          completeProbeJob={completeProbeJob}
        />
      </div>
    </div>
  );
}
