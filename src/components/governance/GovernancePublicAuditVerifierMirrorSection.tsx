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
import { useGovernancePublicAuditVerifierMirrors } from '@/lib/use-governance-public-audit-verifier-mirrors';

interface GovernancePublicAuditVerifierMirrorSectionProps {
  latestBatchId: string | null;
  formatTimestamp: (value: string | null) => string;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function GovernancePublicAuditVerifierMirrorSection({
  latestBatchId,
  formatTimestamp,
}: GovernancePublicAuditVerifierMirrorSectionProps) {
  const {
    loadingMirrorData,
    mirrorBackendUnavailable,
    canManageVerifierMirrors,
    registeringVerifierMirror,
    recordingVerifierMirrorCheck,
    togglingMirrorId,
    verifierMirrorHealthRows,
    clientVerifierBundle,
    loadMirrorData,
    registerVerifierMirror,
    recordVerifierMirrorCheck,
    setVerifierMirrorActive,
  } = useGovernancePublicAuditVerifierMirrors({ latestBatchId });

  const [mirrorDraft, setMirrorDraft] = useState({
    mirrorKey: '',
    mirrorLabel: '',
    endpointUrl: '',
    mirrorType: 'https_gateway',
    regionCode: 'GLOBAL',
    jurisdictionCountryCode: '',
    operatorLabel: '',
  });

  const [mirrorCheckDraft, setMirrorCheckDraft] = useState({
    mirrorId: '',
    checkStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    latencyMs: '',
    observedBatchHash: '',
    errorMessage: '',
  });

  if (mirrorBackendUnavailable) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Replaceable verifier mirrors</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={loadingMirrorData}
          onClick={() => void loadMirrorData()}
        >
          {loadingMirrorData ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Refresh mirrors
        </Button>
      </div>

      {clientVerifierBundle && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={clientVerifierBundle.quorumMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Client bundle {clientVerifierBundle.quorumMet ? 'quorum met' : 'quorum pending'}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Healthy mirrors {clientVerifierBundle.healthyMirrorCount}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Bundle {previewHash(clientVerifierBundle.bundleHash)}
          </Badge>
          {clientVerifierBundle.failoverPolicy && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Failover min {clientVerifierBundle.failoverPolicy.minHealthyMirrors}
            </Badge>
          )}
          {clientVerifierBundle.signedDirectoryHash && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Directory {previewHash(clientVerifierBundle.signedDirectoryHash)}
            </Badge>
          )}
          {clientVerifierBundle.signedDirectoryTrust && (
            <Badge
              variant="outline"
              className={clientVerifierBundle.signedDirectoryTrust.trustQuorumMet
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Directory trust {clientVerifierBundle.signedDirectoryTrust.trustQuorumMet ? 'met' : 'pending'}
            </Badge>
          )}
          {clientVerifierBundle.federationDiversity && (
            <Badge
              variant="outline"
              className={clientVerifierBundle.federationDiversity.meetsRegionDiversity && clientVerifierBundle.federationDiversity.meetsOperatorDiversity
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Diversity R{clientVerifierBundle.federationDiversity.distinctRegionCount}/{clientVerifierBundle.federationDiversity.requiredDistinctRegions}
              {' '}O{clientVerifierBundle.federationDiversity.distinctOperatorCount}/{clientVerifierBundle.federationDiversity.requiredDistinctOperators}
            </Badge>
          )}
          {clientVerifierBundle.policyRatification && (
            <Badge
              variant="outline"
              className={clientVerifierBundle.policyRatification.ratificationMet
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Policy ratification {clientVerifierBundle.policyRatification.ratificationMet ? 'met' : 'pending'}
            </Badge>
          )}
          {clientVerifierBundle.federationOperations && (
            <Badge
              variant="outline"
              className={clientVerifierBundle.federationOperations.federationOpsReady
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Federation ops {clientVerifierBundle.federationOperations.federationOpsReady ? 'ready' : 'pending'}
            </Badge>
          )}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
          <p className="font-medium text-foreground">Mirror registry</p>
          {canManageVerifierMirrors && (
            <>
              <Input
                value={mirrorDraft.mirrorKey}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, mirrorKey: event.target.value }))}
                placeholder="Mirror key"
              />
              <Input
                value={mirrorDraft.mirrorLabel}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, mirrorLabel: event.target.value }))}
                placeholder="Mirror label"
              />
              <Input
                value={mirrorDraft.endpointUrl}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
                placeholder="Endpoint URL"
              />
              <Input
                value={mirrorDraft.mirrorType}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, mirrorType: event.target.value }))}
                placeholder="Mirror type"
              />
              <Input
                value={mirrorDraft.regionCode}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, regionCode: event.target.value.toUpperCase() }))}
                placeholder="Region code"
              />
              <Input
                value={mirrorDraft.jurisdictionCountryCode}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, jurisdictionCountryCode: event.target.value.toUpperCase() }))}
                placeholder="Jurisdiction code (optional)"
                maxLength={2}
              />
              <Input
                value={mirrorDraft.operatorLabel}
                onChange={(event) => setMirrorDraft((current) => ({ ...current, operatorLabel: event.target.value }))}
                placeholder="Operator label"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={registeringVerifierMirror || !mirrorDraft.mirrorKey.trim() || !mirrorDraft.endpointUrl.trim()}
                onClick={() => void registerVerifierMirror(mirrorDraft)}
              >
                {registeringVerifierMirror ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save mirror
              </Button>
            </>
          )}

          <div className="space-y-2">
            {verifierMirrorHealthRows.map((mirror) => (
              <div key={mirror.mirrorId} className="rounded-md border border-border/60 bg-background p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{mirror.mirrorLabel || mirror.mirrorKey}</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={mirror.healthStatus === 'healthy'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : mirror.healthStatus === 'degraded'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : mirror.healthStatus === 'critical'
                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            : 'border-border bg-muted text-muted-foreground'}
                    >
                      {mirror.healthStatus}
                    </Badge>
                    {canManageVerifierMirrors && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={togglingMirrorId === mirror.mirrorId}
                        onClick={() => void setVerifierMirrorActive(mirror.mirrorId, !mirror.isActive)}
                      >
                        {togglingMirrorId === mirror.mirrorId
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : mirror.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-muted-foreground">{mirror.endpointUrl}</p>
                <p className="text-muted-foreground">
                  {mirror.regionCode} • {mirror.operatorLabel}
                  {mirror.jurisdictionCountryCode ? ` • ${mirror.jurisdictionCountryCode}` : ''}
                </p>
                <p className="text-muted-foreground">
                  Last check: {formatTimestamp(mirror.lastCheckAt)}
                  {typeof mirror.lastCheckLatencyMs === 'number' ? ` • ${mirror.lastCheckLatencyMs}ms` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>

        {canManageVerifierMirrors && (
          <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
            <p className="font-medium text-foreground">Record mirror check</p>
            <Label className="text-xs">Mirror</Label>
            <Select
              value={mirrorCheckDraft.mirrorId}
              onValueChange={(value) => setMirrorCheckDraft((current) => ({ ...current, mirrorId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mirror" />
              </SelectTrigger>
              <SelectContent>
                {verifierMirrorHealthRows.filter((mirror) => mirror.isActive).map((mirror) => (
                  <SelectItem key={mirror.mirrorId} value={mirror.mirrorId}>
                    {mirror.mirrorLabel || mirror.mirrorKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={mirrorCheckDraft.checkStatus}
              onValueChange={(value) => setMirrorCheckDraft((current) => ({ ...current, checkStatus: value as typeof current.checkStatus }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Check status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={mirrorCheckDraft.latencyMs}
              onChange={(event) => setMirrorCheckDraft((current) => ({ ...current, latencyMs: event.target.value }))}
              placeholder="Latency ms (optional)"
            />
            <Input
              value={mirrorCheckDraft.observedBatchHash}
              onChange={(event) => setMirrorCheckDraft((current) => ({ ...current, observedBatchHash: event.target.value }))}
              placeholder="Observed batch hash (optional)"
            />
            <Input
              value={mirrorCheckDraft.errorMessage}
              onChange={(event) => setMirrorCheckDraft((current) => ({ ...current, errorMessage: event.target.value }))}
              placeholder="Error message (optional)"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={recordingVerifierMirrorCheck || !mirrorCheckDraft.mirrorId}
              onClick={() => void recordVerifierMirrorCheck(mirrorCheckDraft)}
            >
              {recordingVerifierMirrorCheck ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save mirror check
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
