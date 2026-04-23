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
import { Textarea } from '@/components/ui/textarea';
import { formatActivationDemographicFeedScopeLabel } from '@/lib/governance-activation-demographic-worker';
import { useGovernanceActivationDemographicFeeds } from '@/lib/use-governance-activation-demographic-feeds';
interface GovernanceActivationFeedAdaptersPanelProps {
  formatTimestamp: (value: string | null) => string;
}
function getLocalDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function formatShortWorkerIdentity(value: string | null) {
  if (!value?.trim()) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 52 ? `${trimmed.slice(0, 52)}…` : trimmed;
}

function countFeedWorkerAlerts(alert: {
  freshness_alert: boolean;
  signature_failure_count: number;
  connectivity_failure_count: number;
  payload_failure_count: number;
}) {
  return (
    (alert.freshness_alert ? 1 : 0)
    + alert.signature_failure_count
    + alert.connectivity_failure_count
    + alert.payload_failure_count
  );
}
export function GovernanceActivationFeedAdaptersPanel({
  formatTimestamp,
}: GovernanceActivationFeedAdaptersPanelProps) {
  const {
    loadingFeedData,
    feedBackendUnavailable,
    feedWorkerBackendUnavailable,
    canManageFeeds,
    registeringFeedAdapter,
    ingestingSignedFeedSnapshot,
    runningFeedWorkers,
    schedulingFeedWorkerJobs,
    processingFeedOutbox,
    releasingStaleFeedWorkerClaims,
    escalatingFeedWorkerPublicExecution,
    pendingFeedOutboxCount,
    resolvingFeedAlertKey,
    openFeedWorkerAlertsCount,
    feedAdapters,
    feedIngestions,
    feedIngestionsHasMore,
    loadingMoreFeedIngestions,
    feedWorkerAlerts,
    feedWorkerOutboxActiveJobs,
    feedWorkerSchedulePolicy,
    loadFeedData,
    loadMoreFeedIngestions,
    registerFeedAdapter,
    ingestSignedFeedSnapshot,
    scheduleFeedWorkerJobs,
    processFeedWorkerOutboxQueue,
    releaseStaleFeedWorkerClaims,
    runFeedWorkerSweep,
    escalateFeedWorkerAlertsToPublicExecution,
    resolveFeedAlert,
  } = useGovernanceActivationDemographicFeeds();

  const [adapterDraft, setAdapterDraft] = useState({
    adapterKey: '',
    adapterName: '',
    scopeType: 'world' as 'world' | 'country',
    countryCode: '',
    endpointUrl: '',
    publicSignerKey: '',
    keyAlgorithm: 'ECDSA_P256_SHA256_V1',
  });
  const [ingestionDraft, setIngestionDraft] = useState({
    adapterId: '',
    targetPopulation: '',
    observedAt: getLocalDateTimeInputValue(),
    sourceUrl: '',
    signedPayload: '',
    payloadSignature: '',
    ingestionNotes: '',
  });

  const activeAdapters = useMemo(
    () => feedAdapters.filter((adapter) => adapter.is_active),
    [feedAdapters],
  );

  const feedAdapterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const adapter of feedAdapters) {
      map.set(adapter.id, adapter.adapter_name);
    }
    return map;
  }, [feedAdapters]);

  if (feedBackendUnavailable) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground">
          Signed demographic feed adapters are not available in this environment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Signed demographic feed adapters</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            {activeAdapters.length} active adapters
          </Badge>
          <Badge
            variant="outline"
            className={openFeedWorkerAlertsCount > 0
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}
          >
            {openFeedWorkerAlertsCount > 0 ? `${openFeedWorkerAlertsCount} worker alerts` : 'Worker alerts clear'}
          </Badge>
          <Badge
            variant="outline"
            className={pendingFeedOutboxCount > 0
              ? 'border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200'
              : 'border-border bg-muted text-muted-foreground'}
          >
            {pendingFeedOutboxCount > 0 ? `${pendingFeedOutboxCount} queued sweeps` : 'Sweep queue empty'}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void scheduleFeedWorkerJobs(false)}
            disabled={schedulingFeedWorkerJobs || !canManageFeeds || feedWorkerBackendUnavailable}
          >
            {schedulingFeedWorkerJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Queue due sweeps
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void processFeedWorkerOutboxQueue()}
            disabled={processingFeedOutbox || !canManageFeeds || feedWorkerBackendUnavailable}
          >
            {processingFeedOutbox ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Process sweep queue
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void releaseStaleFeedWorkerClaims()}
            disabled={releasingStaleFeedWorkerClaims || !canManageFeeds || feedWorkerBackendUnavailable}
          >
            {releasingStaleFeedWorkerClaims ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Release stuck sweep claims
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void runFeedWorkerSweep()}
            disabled={runningFeedWorkers || !canManageFeeds || feedWorkerBackendUnavailable}
          >
            {runningFeedWorkers ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run worker sweep
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void loadFeedData()}
            disabled={loadingFeedData}
          >
            {loadingFeedData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh feeds
          </Button>
        </div>
      </div>

      {feedWorkerSchedulePolicy && !feedWorkerBackendUnavailable ? (
        <div className="mt-3 space-y-1 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground/80">Scheduled sweeps:</span>{' '}
            new queue entries aim for roughly{' '}
            {Math.max(1, feedWorkerSchedulePolicy.default_interval_minutes)} minutes between due runs per adapter
            (unless an adapter sets its own interval). Stuck work releases after about{' '}
            {Math.max(1, feedWorkerSchedulePolicy.claim_ttl_minutes)} minutes.
          </p>
          <p>
            If a browser session stops mid-queue, claims past that timeout return to pending automatically, or you can use Release stuck sweep claims to run the same cleanup on demand.
          </p>
          <p>
            When your Postgres instance has the hourly automation extension enabled, due jobs can enqueue on their own without leaving this screen open.
          </p>
        </div>
      ) : null}

      {!feedWorkerBackendUnavailable ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Active sweep queue jobs
          </p>
          {feedWorkerOutboxActiveJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No jobs are pending or in progress right now.
            </p>
          ) : (
            <div className="max-h-44 space-y-2 overflow-y-auto text-xs text-muted-foreground">
              {feedWorkerOutboxActiveJobs.map((job) => {
                const adapterLabel = feedAdapterNameById.get(job.adapter_id) ?? 'Adapter';
                const workerLabel = formatShortWorkerIdentity(job.worker_identity);
                return (
                  <div key={job.id} className="rounded-md border border-border/50 bg-card/60 px-2 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{adapterLabel}</p>
                      <Badge
                        variant="outline"
                        className={job.status === 'claimed'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                          : 'border-sky-500/20 bg-sky-500/10 text-sky-900 dark:text-sky-100'}
                      >
                        {job.status === 'claimed' ? 'Claimed' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="mt-1">
                      Requested {formatTimestamp(job.requested_at)}
                      {job.claimed_at ? ` • claimed ${formatTimestamp(job.claimed_at)}` : ''}
                      {job.claim_expires_at ? ` • claim expires ${formatTimestamp(job.claim_expires_at)}` : ''}
                    </p>
                    {typeof job.attempt_count === 'number' && job.attempt_count > 0 ? (
                      <p className="mt-0.5">Attempts {job.attempt_count}</p>
                    ) : null}
                    {workerLabel ? (
                      <p className="mt-0.5 break-all text-muted-foreground">
                        Worker: {workerLabel}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {pendingFeedOutboxCount > feedWorkerOutboxActiveJobs.filter((job) => job.status === 'pending').length ? (
            <p className="text-xs text-muted-foreground">
              Additional pending jobs may exist beyond this list (showing the 25 most recently updated pending or claimed rows).
            </p>
          ) : null}
        </div>
      ) : null}

      {canManageFeeds && !feedWorkerBackendUnavailable ? (
        <div className="mt-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <p>
            If adapters stay unhealthy, you can open or refresh the public audit on-call page for feed workers (same flow as queue and cron ticks). Resolve open pages under Public audit, then Immutable anchoring automation, using the on-call page board.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 w-full gap-2 sm:w-auto"
            disabled={escalatingFeedWorkerPublicExecution}
            onClick={() => void escalateFeedWorkerAlertsToPublicExecution()}
          >
            {escalatingFeedWorkerPublicExecution ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update on-call page for feed worker alerts
          </Button>
        </div>
      ) : null}

      {feedWorkerBackendUnavailable && (
        <p className="mt-2 text-xs text-muted-foreground">
          Worker alert persistence backend is not available here yet. Freshness fallback is still shown.
        </p>
      )}

      {!canManageFeeds ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Feed management is limited to activation and technical stewards.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Register adapter</p>
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
            <Select
              value={adapterDraft.scopeType}
              onValueChange={(value) => setAdapterDraft((current) => ({
                ...current,
                scopeType: value as 'world' | 'country',
                countryCode: value === 'world' ? '' : current.countryCode,
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Adapter scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="world">World</SelectItem>
                <SelectItem value="country">Country</SelectItem>
              </SelectContent>
            </Select>
            {adapterDraft.scopeType === 'country' && (
              <Input
                value={adapterDraft.countryCode}
                onChange={(event) => setAdapterDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))}
                placeholder="Country code"
                maxLength={2}
              />
            )}
            <Input
              value={adapterDraft.endpointUrl}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
              placeholder="Endpoint URL"
            />
            <Input
              value={adapterDraft.publicSignerKey}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, publicSignerKey: event.target.value }))}
              placeholder="Public signer key (base64url spki)"
            />
            <Input
              value={adapterDraft.keyAlgorithm}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, keyAlgorithm: event.target.value }))}
              placeholder="Key algorithm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={registeringFeedAdapter}
              onClick={() => void registerFeedAdapter(adapterDraft)}
            >
              {registeringFeedAdapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save feed adapter
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ingest signed feed snapshot</p>
            <Label className="text-xs">Adapter</Label>
            <Select
              value={ingestionDraft.adapterId}
              onValueChange={(value) => setIngestionDraft((current) => ({ ...current, adapterId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select adapter" />
              </SelectTrigger>
              <SelectContent>
                {activeAdapters.map((adapter) => (
                  <SelectItem key={adapter.id} value={adapter.id}>{adapter.adapter_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={ingestionDraft.targetPopulation}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, targetPopulation: event.target.value }))}
              placeholder="Target population"
            />
            <Input
              type="datetime-local"
              value={ingestionDraft.observedAt}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, observedAt: event.target.value }))}
            />
            <Input
              value={ingestionDraft.sourceUrl}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, sourceUrl: event.target.value }))}
              placeholder="Source URL (optional)"
            />
            <Textarea
              value={ingestionDraft.signedPayload}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, signedPayload: event.target.value }))}
              rows={3}
              placeholder="Signed payload"
            />
            <Input
              value={ingestionDraft.payloadSignature}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, payloadSignature: event.target.value }))}
              placeholder="Payload signature (base64url)"
            />
            <Textarea
              value={ingestionDraft.ingestionNotes}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, ingestionNotes: event.target.value }))}
              rows={2}
              placeholder="Ingestion notes"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={ingestingSignedFeedSnapshot}
              onClick={() => void ingestSignedFeedSnapshot(ingestionDraft)}
            >
              {ingestingSignedFeedSnapshot ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify and ingest signed snapshot
            </Button>
          </div>
        </div>
      )}

      {feedWorkerAlerts.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Worker freshness + signature alerts</p>
          {feedWorkerAlerts.slice(0, 8).map((alert) => {
            const alertCount = countFeedWorkerAlerts(alert);
            const resolveAllKey = `${alert.adapter_id}:all`;
            const scopeLabel = formatActivationDemographicFeedScopeLabel(alert.scope_type, alert.country_code);
            const adapterRow = feedAdapters.find((adapter) => adapter.id === alert.adapter_id);
            const customSweepMinutes = adapterRow?.worker_sweep_interval_minutes;

            return (
              <div key={alert.adapter_id} className="rounded-md border border-border/60 bg-card p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {alert.adapter_name} ({scopeLabel})
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    {alert.freshness_alert && (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        Freshness stale{typeof alert.stale_by_hours === 'number' ? ` ${alert.stale_by_hours}h` : ''}
                      </Badge>
                    )}
                    {alert.signature_failure_count > 0 && (
                      <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                        Signature {alert.signature_failure_count}
                      </Badge>
                    )}
                    {alert.connectivity_failure_count > 0 && (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        Connectivity {alert.connectivity_failure_count}
                      </Badge>
                    )}
                    {alert.payload_failure_count > 0 && (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        Payload {alert.payload_failure_count}
                      </Badge>
                    )}
                    {alertCount === 0 && (
                      <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        Healthy
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="mt-1 text-muted-foreground">
                  Last ingested: {formatTimestamp(alert.last_ingested_at)}
                </p>
                {typeof customSweepMinutes === 'number' && customSweepMinutes > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    This adapter requests a queued sweep about every {customSweepMinutes} minutes (overrides the default schedule above).
                  </p>
                ) : null}
                {alert.latest_run_message && (
                  <p className="text-muted-foreground">
                    Latest worker run: {alert.latest_run_message}
                    {alert.latest_run_at ? ` (${formatTimestamp(alert.latest_run_at)})` : ''}
                  </p>
                )}

                {canManageFeeds && !feedWorkerBackendUnavailable && alertCount > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={resolvingFeedAlertKey === resolveAllKey}
                      onClick={() => void resolveFeedAlert(alert.adapter_id, null)}
                    >
                      {resolvingFeedAlertKey === resolveAllKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve all'}
                    </Button>
                    {alert.signature_failure_count > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingFeedAlertKey === `${alert.adapter_id}:signature_failure`}
                        onClick={() => void resolveFeedAlert(alert.adapter_id, 'signature_failure')}
                      >
                        {resolvingFeedAlertKey === `${alert.adapter_id}:signature_failure`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : 'Resolve signature'}
                      </Button>
                    )}
                    {alert.connectivity_failure_count > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingFeedAlertKey === `${alert.adapter_id}:connectivity`}
                        onClick={() => void resolveFeedAlert(alert.adapter_id, 'connectivity')}
                      >
                        {resolvingFeedAlertKey === `${alert.adapter_id}:connectivity`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : 'Resolve connectivity'}
                      </Button>
                    )}
                    {alert.payload_failure_count > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingFeedAlertKey === `${alert.adapter_id}:payload`}
                        onClick={() => void resolveFeedAlert(alert.adapter_id, 'payload')}
                      >
                        {resolvingFeedAlertKey === `${alert.adapter_id}:payload`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : 'Resolve payload'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {feedIngestions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/50 p-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recent signed ingestions
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
              ({feedIngestions.length} loaded{feedIngestionsHasMore ? ', more available' : ''})
            </span>
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {feedIngestions.map((ingestion) => {
              const adapterLabel = feedAdapterNameById.get(ingestion.adapter_id) ?? 'Adapter';
              const scopeLabel = ingestion.scope_type === 'world' ? 'World' : ingestion.country_code;
              return (
                <p key={ingestion.id}>
                  {adapterLabel} • {scopeLabel} • population {ingestion.target_population} • {ingestion.ingestion_status}
                  {' • '}
                  observed {formatTimestamp(ingestion.observed_at)} • recorded {formatTimestamp(ingestion.created_at)}
                </p>
              );
            })}
          </div>
          {feedIngestionsHasMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={loadingMoreFeedIngestions || feedBackendUnavailable}
              onClick={() => void loadMoreFeedIngestions()}
            >
              {loadingMoreFeedIngestions ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load older ingestions
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
