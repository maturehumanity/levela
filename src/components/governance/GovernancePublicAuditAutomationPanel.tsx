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
import {
  GovernancePublicAuditAnchorExecutionJobCompletionSection,
  GovernancePublicAuditVerifierJobCompletionSection,
} from '@/components/governance/GovernancePublicAuditAutomationJobCompletionSections';
import { useGovernancePublicAuditAutomation } from '@/lib/use-governance-public-audit-automation';

interface GovernancePublicAuditAutomationPanelProps {
  latestBatchId: string | null;
  formatTimestamp: (value: string | null) => string;
}

function formatFailureShare(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)}%`;
}

export function GovernancePublicAuditAutomationPanel({
  latestBatchId,
  formatTimestamp,
}: GovernancePublicAuditAutomationPanelProps) {
  const {
    loadingAutomationData,
    automationBackendUnavailable,
    canManageAutomation,
    registeringAnchorAdapter,
    recordingImmutableAnchor,
    schedulingAnchorExecutionJobs,
    schedulingVerifierJobs,
    runningExternalExecutionCycle,
    completingAnchorExecutionJob,
    completingVerifierJob,
    anchorAdapters,
    immutableAnchors,
    anchorExecutionJobs,
    verifierJobs,
    operationsSlaSummary,
    loadAutomationData,
    registerAnchorAdapter,
    recordImmutableAnchor,
    scheduleAnchorExecutionJobs,
    scheduleVerifierJobs,
    runExternalExecutionCycle,
    completeAnchorExecutionJob,
    completeVerifierJob,
  } = useGovernancePublicAuditAutomation({ latestBatchId });

  const [adapterDraft, setAdapterDraft] = useState({
    adapterKey: '',
    adapterName: '',
    network: '',
    endpointUrl: '',
    attestationScheme: 'append_only_receipt_v1',
  });
  const [immutableAnchorDraft, setImmutableAnchorDraft] = useState({
    adapterId: 'none',
    network: '',
    immutableReference: '',
    blockHeight: '',
  });

  const activeAnchorAdapters = useMemo(
    () => anchorAdapters.filter((adapter) => adapter.is_active),
    [anchorAdapters],
  );
  const pendingVerifierJobs = useMemo(
    () => verifierJobs.filter((job) => job.status === 'pending'),
    [verifierJobs],
  );
  const pendingAnchorExecutionJobs = useMemo(
    () => anchorExecutionJobs.filter((job) => job.status === 'pending'),
    [anchorExecutionJobs],
  );

  if (automationBackendUnavailable) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground">
          Immutable anchor adapters, execution workers, and verifier automation are not available in this environment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Immutable anchoring external execution ops</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void loadAutomationData()}
          disabled={loadingAutomationData}
        >
          {loadingAutomationData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh automation
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          Active adapters {activeAnchorAdapters.length}
        </Badge>
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          Immutable anchors {immutableAnchors.length}
        </Badge>
        <Badge variant="outline" className={pendingAnchorExecutionJobs.length > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}>
          Pending anchor jobs {pendingAnchorExecutionJobs.length}
        </Badge>
        <Badge variant="outline" className={pendingVerifierJobs.length > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}>
          Pending verifier jobs {pendingVerifierJobs.length}
        </Badge>
        {operationsSlaSummary && (
          <Badge variant="outline" className={operationsSlaSummary.overallSlaMet ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'}>
            SLA {operationsSlaSummary.overallSlaMet ? 'met' : 'at risk'}
          </Badge>
        )}
      </div>

      {operationsSlaSummary && (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">SLA window</p>
            <p className="mt-1">Pending SLA: {operationsSlaSummary.pendingSlaHours}h</p>
            <p>Lookback: {operationsSlaSummary.lookbackHours}h</p>
            <p>Active adapters: {operationsSlaSummary.activeAnchorAdapterCount}</p>
            <p>Active verifiers: {operationsSlaSummary.activeVerifierCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Anchor workers</p>
            <p className="mt-1">Pending: {operationsSlaSummary.anchorPendingCount}</p>
            <p>Stale pending: {operationsSlaSummary.anchorStalePendingCount}</p>
            <p>Lookback failures: {operationsSlaSummary.anchorFailedLookbackCount}</p>
            <p>Failure share: {formatFailureShare(operationsSlaSummary.anchorFailureSharePercent)}</p>
            <p>Oldest pending: {formatTimestamp(operationsSlaSummary.oldestAnchorPendingAt)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Verifier workers</p>
            <p className="mt-1">Pending: {operationsSlaSummary.verifierPendingCount}</p>
            <p>Stale pending: {operationsSlaSummary.verifierStalePendingCount}</p>
            <p>Lookback failures: {operationsSlaSummary.verifierFailedLookbackCount}</p>
            <p>Failure share: {formatFailureShare(operationsSlaSummary.verifierFailureSharePercent)}</p>
            <p>Oldest pending: {formatTimestamp(operationsSlaSummary.oldestVerifierPendingAt)}</p>
          </div>
        </div>
      )}

      {!canManageAutomation ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Automation controls are limited to public-audit verifier stewards.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Anchor adapter registry</p>
            <Input
              value={adapterDraft.adapterKey}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, adapterKey: event.target.value }))}
              placeholder="Adapter key"
            />
            <Input
              value={adapterDraft.adapterName}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, adapterName: event.target.value }))}
              placeholder="Adapter name"
            />
            <Input
              value={adapterDraft.network}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, network: event.target.value }))}
              placeholder="Network"
            />
            <Input
              value={adapterDraft.endpointUrl}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
              placeholder="Endpoint URL"
            />
            <Input
              value={adapterDraft.attestationScheme}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, attestationScheme: event.target.value }))}
              placeholder="Attestation scheme"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={registeringAnchorAdapter}
              onClick={() => void registerAnchorAdapter(adapterDraft)}
            >
              {registeringAnchorAdapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save anchor adapter
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">External execution controls</p>
            <Label className="text-xs">Adapter override for manual anchor</Label>
            <Select
              value={immutableAnchorDraft.adapterId}
              onValueChange={(value) => setImmutableAnchorDraft((current) => ({ ...current, adapterId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select adapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No adapter override</SelectItem>
                {activeAnchorAdapters.map((adapter) => (
                  <SelectItem key={adapter.id} value={adapter.id}>
                    {adapter.adapter_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={immutableAnchorDraft.network}
              onChange={(event) => setImmutableAnchorDraft((current) => ({ ...current, network: event.target.value }))}
              placeholder="Network override (optional)"
            />
            <Input
              value={immutableAnchorDraft.immutableReference}
              onChange={(event) => setImmutableAnchorDraft((current) => ({ ...current, immutableReference: event.target.value }))}
              placeholder="Immutable reference"
            />
            <Input
              value={immutableAnchorDraft.blockHeight}
              onChange={(event) => setImmutableAnchorDraft((current) => ({ ...current, blockHeight: event.target.value }))}
              placeholder="Block height (optional)"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={!latestBatchId || recordingImmutableAnchor}
              onClick={() => void recordImmutableAnchor({
                ...immutableAnchorDraft,
                adapterId: immutableAnchorDraft.adapterId === 'none' ? '' : immutableAnchorDraft.adapterId,
              })}
            >
              {recordingImmutableAnchor ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Record immutable anchor
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={schedulingAnchorExecutionJobs}
              onClick={() => void scheduleAnchorExecutionJobs(false)}
            >
              {schedulingAnchorExecutionJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Schedule anchor execution jobs
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={schedulingVerifierJobs}
              onClick={() => void scheduleVerifierJobs(false)}
            >
              {schedulingVerifierJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Schedule verifier jobs
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={runningExternalExecutionCycle}
              onClick={() => void runExternalExecutionCycle(false)}
            >
              {runningExternalExecutionCycle ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run external execution cycle
            </Button>
          </div>
        </div>
      )}

      {canManageAutomation && anchorExecutionJobs.length > 0 && (
        <GovernancePublicAuditAnchorExecutionJobCompletionSection
          anchorExecutionJobs={anchorExecutionJobs}
          formatTimestamp={formatTimestamp}
          completingAnchorExecutionJob={completingAnchorExecutionJob}
          completeAnchorExecutionJob={completeAnchorExecutionJob}
        />
      )}

      {canManageAutomation && verifierJobs.length > 0 && (
        <GovernancePublicAuditVerifierJobCompletionSection
          verifierJobs={verifierJobs}
          formatTimestamp={formatTimestamp}
          completingVerifierJob={completingVerifierJob}
          completeVerifierJob={completeVerifierJob}
        />
      )}
    </div>
  );
}
