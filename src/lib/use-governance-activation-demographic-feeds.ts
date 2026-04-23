import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  buildFallbackWorkerAlertRows,
  FEED_WORKER_DEFAULT_FRESHNESS_HOURS,
  runActivationDemographicFeedWorkerSweep,
  type RecordFeedWorkerRunDraft,
} from '@/lib/governance-activation-demographic-feed-workers';
import {
  isMissingActivationDemographicFeedBackend,
  isMissingActivationDemographicFeedWorkerBackend,
  type ActivationDemographicFeedAdapterRow,
  type ActivationDemographicFeedAlertType,
  type ActivationDemographicFeedIngestionRow,
  type ActivationDemographicFeedWorkerAlertSummaryRow,
} from '@/lib/governance-activation-demographic-feeds';
import {
  hashActivationDemographicPayload,
  verifyActivationDemographicPayloadSignature,
} from '@/lib/governance-activation-demographic-signing';

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

type RpcResponseLike<T> = {
  data: T | null;
  error: RpcErrorLike;
};

function callUntypedRpc<T>(fnName: string, params?: Record<string, unknown>) {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResponseLike<T>>;

  return rpc(fnName, params);
}

export type ActivationDemographicFeedWorkerSchedulePolicyRow =
  Database['public']['Tables']['activation_demographic_feed_worker_schedule_policies']['Row'];

export function useGovernanceActivationDemographicFeeds() {
  const [loadingFeedData, setLoadingFeedData] = useState(true);
  const [feedBackendUnavailable, setFeedBackendUnavailable] = useState(false);
  const [feedWorkerBackendUnavailable, setFeedWorkerBackendUnavailable] = useState(false);
  const [canManageFeeds, setCanManageFeeds] = useState(false);
  const [registeringFeedAdapter, setRegisteringFeedAdapter] = useState(false);
  const [ingestingSignedFeedSnapshot, setIngestingSignedFeedSnapshot] = useState(false);
  const [runningFeedWorkers, setRunningFeedWorkers] = useState(false);
  const [schedulingFeedWorkerJobs, setSchedulingFeedWorkerJobs] = useState(false);
  const [processingFeedOutbox, setProcessingFeedOutbox] = useState(false);
  const [escalatingFeedWorkerPublicExecution, setEscalatingFeedWorkerPublicExecution] = useState(false);
  const [resolvingFeedAlertKey, setResolvingFeedAlertKey] = useState<string | null>(null);
  const [pendingFeedOutboxCount, setPendingFeedOutboxCount] = useState(0);
  const [feedAdapters, setFeedAdapters] = useState<ActivationDemographicFeedAdapterRow[]>([]);
  const [feedIngestions, setFeedIngestions] = useState<ActivationDemographicFeedIngestionRow[]>([]);
  const [feedWorkerAlerts, setFeedWorkerAlerts] = useState<ActivationDemographicFeedWorkerAlertSummaryRow[]>([]);
  const [feedWorkerSchedulePolicy, setFeedWorkerSchedulePolicy] =
    useState<ActivationDemographicFeedWorkerSchedulePolicyRow | null>(null);

  const openFeedWorkerAlertsCount = useMemo(
    () => feedWorkerAlerts.reduce((count, alert) => count
      + (alert.freshness_alert ? 1 : 0)
      + alert.signature_failure_count
      + alert.connectivity_failure_count
      + alert.payload_failure_count, 0),
    [feedWorkerAlerts],
  );

  const recordFeedWorkerRun = useCallback(async (draft: RecordFeedWorkerRunDraft) => {
    if (feedBackendUnavailable || feedWorkerBackendUnavailable) {
      return;
    }

    const { error } = await callUntypedRpc<unknown>('record_activation_demographic_feed_worker_run', {
      target_adapter_id: draft.adapterId,
      worker_status: draft.status,
      worker_alert_type: draft.alertType,
      worker_alert_severity: draft.severity,
      worker_message: draft.message,
      worker_observed_at: draft.observedAt ?? new Date().toISOString(),
      worker_payload_hash: draft.payloadHash ?? null,
      worker_metadata: draft.metadata ?? {},
      worker_resolved_at: draft.resolvedAt ?? null,
    });

    if (!error) return;

    if (isMissingActivationDemographicFeedWorkerBackend(error)) {
      setFeedWorkerBackendUnavailable(true);
      return;
    }

    console.error('Failed to record activation demographic feed worker run:', {
      draft,
      error,
    });
  }, [feedBackendUnavailable, feedWorkerBackendUnavailable]);

  const loadFeedData = useCallback(async () => {
    setLoadingFeedData(true);

    const [
      adapterResponse,
      ingestionResponse,
      permissionResponse,
      workerSummaryResponse,
      pendingOutboxResponse,
      schedulePolicyResponse,
    ] = await Promise.all([
      supabase
        .from('activation_demographic_feed_adapters')
        .select('*')
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('activation_demographic_feed_ingestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.rpc('current_profile_can_manage_activation_demographic_feeds'),
      callUntypedRpc<ActivationDemographicFeedWorkerAlertSummaryRow[]>('activation_demographic_feed_worker_alert_summary', {
        requested_freshness_hours: FEED_WORKER_DEFAULT_FRESHNESS_HOURS,
      }),
      supabase
        .from('activation_demographic_feed_worker_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('activation_demographic_feed_worker_schedule_policies')
        .select('*')
        .eq('policy_key', 'default')
        .maybeSingle(),
    ]);

    const sharedError = adapterResponse.error || ingestionResponse.error || permissionResponse.error;
    if (isMissingActivationDemographicFeedBackend(sharedError)) {
      setFeedBackendUnavailable(true);
      setLoadingFeedData(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load activation demographic feed data:', {
        adapterError: adapterResponse.error,
        ingestionError: ingestionResponse.error,
        permissionError: permissionResponse.error,
      });
      toast.error('Could not load signed demographic feed data.');
      setLoadingFeedData(false);
      return;
    }

    const adapters = (adapterResponse.data as ActivationDemographicFeedAdapterRow[]) || [];
    setFeedAdapters(adapters);
    setFeedIngestions((ingestionResponse.data as ActivationDemographicFeedIngestionRow[]) || []);
    setCanManageFeeds(Boolean(permissionResponse.data));
    setFeedBackendUnavailable(false);

    if (workerSummaryResponse?.error) {
      if (isMissingActivationDemographicFeedWorkerBackend(workerSummaryResponse.error)) {
        setFeedWorkerBackendUnavailable(true);
      } else {
        console.error('Failed to load activation feed worker alerts summary:', workerSummaryResponse.error);
      }
      setFeedWorkerAlerts(buildFallbackWorkerAlertRows(adapters));
    } else {
      const workerRows = Array.isArray(workerSummaryResponse?.data)
        ? workerSummaryResponse.data as ActivationDemographicFeedWorkerAlertSummaryRow[]
        : [];
      setFeedWorkerAlerts(workerRows);
      setFeedWorkerBackendUnavailable(false);
    }

    if (pendingOutboxResponse.error) {
      if (isMissingActivationDemographicFeedWorkerBackend(pendingOutboxResponse.error)) {
        setFeedWorkerBackendUnavailable(true);
      }
      setPendingFeedOutboxCount(0);
    } else {
      setPendingFeedOutboxCount(pendingOutboxResponse.count ?? 0);
    }

    if (schedulePolicyResponse.error) {
      if (isMissingActivationDemographicFeedWorkerBackend(schedulePolicyResponse.error)) {
        setFeedWorkerBackendUnavailable(true);
      }
      setFeedWorkerSchedulePolicy(null);
    } else {
      setFeedWorkerSchedulePolicy(
        (schedulePolicyResponse.data as ActivationDemographicFeedWorkerSchedulePolicyRow | null) ?? null,
      );
    }

    setLoadingFeedData(false);
  }, []);

  useEffect(() => {
    void loadFeedData();
  }, [loadFeedData]);

  const fetchFeedAdapterById = useCallback(async (adapterId: string) => {
    const { data, error } = await supabase
      .from('activation_demographic_feed_adapters')
      .select('*')
      .eq('id', adapterId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as ActivationDemographicFeedAdapterRow;
  }, []);

  const registerFeedAdapter = useCallback(async (draft: {
    adapterKey: string;
    adapterName: string;
    scopeType: 'world' | 'country';
    countryCode: string;
    endpointUrl: string;
    publicSignerKey: string;
    keyAlgorithm: string;
  }) => {
    if (!canManageFeeds || feedBackendUnavailable) return;

    const normalizedKey = draft.adapterKey.trim();
    const normalizedName = draft.adapterName.trim();
    const normalizedSignerKey = draft.publicSignerKey.trim();

    if (!normalizedKey || !normalizedName || !normalizedSignerKey) {
      toast.error('Adapter key, name, and signer key are required.');
      return;
    }

    if (draft.scopeType === 'country' && !draft.countryCode.trim()) {
      toast.error('Country code is required for country-scoped adapters.');
      return;
    }

    setRegisteringFeedAdapter(true);

    const { error } = await supabase.rpc('register_activation_demographic_feed_adapter', {
      adapter_key: normalizedKey,
      adapter_name: normalizedName,
      adapter_type: 'signed_json_feed',
      scope_type: draft.scopeType,
      country_code: draft.scopeType === 'world' ? '' : draft.countryCode.trim().toUpperCase(),
      endpoint_url: draft.endpointUrl.trim() || null,
      public_signer_key: normalizedSignerKey,
      key_algorithm: draft.keyAlgorithm.trim() || 'ECDSA_P256_SHA256_V1',
      metadata: {
        source: 'governance_activation_feed_panel',
      },
    });

    if (error) {
      console.error('Failed to register activation demographic feed adapter:', error);
      toast.error('Could not register feed adapter.');
      setRegisteringFeedAdapter(false);
      return;
    }

    toast.success('Signed demographic feed adapter saved.');
    setRegisteringFeedAdapter(false);
    await loadFeedData();
  }, [canManageFeeds, feedBackendUnavailable, loadFeedData]);

  const ingestSignedFeedSnapshot = useCallback(async (draft: {
    adapterId: string;
    targetPopulation: string;
    observedAt: string;
    sourceUrl: string;
    signedPayload: string;
    payloadSignature: string;
    ingestionNotes: string;
  }) => {
    if (!canManageFeeds || feedBackendUnavailable) return;

    const adapter = feedAdapters.find((candidate) => candidate.id === draft.adapterId);
    if (!adapter) {
      toast.error('Select a signed feed adapter first.');
      return;
    }

    const signedPayload = draft.signedPayload.trim();
    const payloadSignature = draft.payloadSignature.trim();
    if (!signedPayload || !payloadSignature) {
      toast.error('Signed payload and signature are required.');
      return;
    }

    const parsedPopulation = Number.parseInt(draft.targetPopulation, 10);
    if (!Number.isFinite(parsedPopulation) || parsedPopulation <= 0) {
      toast.error('Target population must be a positive integer.');
      return;
    }

    setIngestingSignedFeedSnapshot(true);

    let payloadHash = '';
    try {
      const verified = await verifyActivationDemographicPayloadSignature({
        keyAlgorithm: adapter.key_algorithm,
        signerPublicKey: adapter.public_signer_key,
        signedPayload,
        signature: payloadSignature,
      });
      if (!verified) {
        toast.error('Signed payload verification failed for this adapter signer key.');
        setIngestingSignedFeedSnapshot(false);
        return;
      }
      payloadHash = await hashActivationDemographicPayload(signedPayload);
    } catch (verificationError) {
      console.error('Failed to verify signed demographic payload:', verificationError);
      toast.error('Could not verify signed payload.');
      setIngestingSignedFeedSnapshot(false);
      return;
    }

    const { error } = await supabase.rpc('ingest_signed_activation_demographic_feed_snapshot', {
      target_adapter_id: adapter.id,
      requested_target_population: parsedPopulation,
      requested_source_url: draft.sourceUrl.trim() || null,
      requested_observed_at: draft.observedAt ? new Date(draft.observedAt).toISOString() : new Date().toISOString(),
      signed_payload: signedPayload,
      payload_hash: payloadHash,
      payload_signature: payloadSignature,
      signature_verified: true,
      ingestion_notes: draft.ingestionNotes.trim() || null,
      ingestion_metadata: {
        source: 'governance_activation_feed_panel',
      },
    });

    if (error) {
      console.error('Failed to ingest signed activation demographic feed snapshot:', error);
      toast.error('Could not ingest signed feed snapshot.');
      setIngestingSignedFeedSnapshot(false);
      return;
    }

    toast.success('Signed demographic feed snapshot ingested and activation thresholds refreshed.');
    setIngestingSignedFeedSnapshot(false);
    await loadFeedData();
  }, [canManageFeeds, feedAdapters, feedBackendUnavailable, loadFeedData]);

  const scheduleFeedWorkerJobs = useCallback(async (forceReschedule = false) => {
    if (!canManageFeeds || feedBackendUnavailable || feedWorkerBackendUnavailable) return;

    setSchedulingFeedWorkerJobs(true);
    const { data, error } = await callUntypedRpc<number>('schedule_activation_demographic_feed_worker_jobs', {
      force_reschedule: forceReschedule,
    });

    if (error) {
      if (isMissingActivationDemographicFeedWorkerBackend(error)) {
        setFeedWorkerBackendUnavailable(true);
      } else {
        console.error('Failed to schedule activation demographic feed worker jobs:', error);
        toast.error('Could not queue scheduled feed worker sweeps.');
      }
      setSchedulingFeedWorkerJobs(false);
      return;
    }

    const count = typeof data === 'number' && Number.isFinite(data) ? Math.max(0, Math.floor(data)) : 0;
    toast.success(
      count > 0
        ? `Queued ${count} feed worker sweep job${count === 1 ? '' : 's'}.`
        : 'No additional feed worker sweeps are due for the configured cadence.',
    );
    setSchedulingFeedWorkerJobs(false);
    await loadFeedData();
  }, [canManageFeeds, feedBackendUnavailable, feedWorkerBackendUnavailable, loadFeedData]);

  const processFeedWorkerOutboxQueue = useCallback(async () => {
    if (!canManageFeeds || feedBackendUnavailable || feedWorkerBackendUnavailable) return;

    setProcessingFeedOutbox(true);

    const authResponse = await supabase.auth.getUser();
    const userId = authResponse.data.user?.id;
    const workerIdentity = userId
      ? `governance_activation_feed_ui:${userId}`
      : `governance_activation_feed_ui:${typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : String(Date.now())}`;

    const { data: claimedRows, error: claimError } = await callUntypedRpc<
      { outbox_job_id: string; adapter_id: string }[]
    >('claim_activation_demographic_feed_worker_jobs', {
      worker_identity: workerIdentity,
      job_limit: 8,
    });

    if (claimError) {
      if (isMissingActivationDemographicFeedWorkerBackend(claimError)) {
        setFeedWorkerBackendUnavailable(true);
      } else {
        console.error('Failed to claim feed worker outbox jobs:', claimError);
        toast.error('Could not claim queued feed worker jobs.');
      }
      setProcessingFeedOutbox(false);
      return;
    }

    const rows = Array.isArray(claimedRows) ? claimedRows : [];
    if (rows.length === 0) {
      toast.message('No pending feed worker jobs in the queue.');
      setProcessingFeedOutbox(false);
      await loadFeedData();
      return;
    }

    for (const row of rows) {
      let adapterRow = feedAdapters.find((adapter) => adapter.id === row.adapter_id) ?? null;
      if (!adapterRow) {
        adapterRow = await fetchFeedAdapterById(row.adapter_id);
      }

      if (!adapterRow) {
        await callUntypedRpc<unknown>('complete_activation_demographic_feed_worker_outbox', {
          target_outbox_id: row.outbox_job_id,
          completed_ok: false,
          resolution_message: 'Adapter row not found while processing outbox job.',
        });
        continue;
      }

      let completedOk = false;
      let resolutionMessage: string | null = null;

      try {
        if (!adapterRow.endpoint_url?.trim()) {
          resolutionMessage = 'Adapter is missing an endpoint URL.';
        } else {
          const stats = await runActivationDemographicFeedWorkerSweep({
            adapters: [adapterRow],
            recordFeedWorkerRun,
          });
          const failures =
            stats.signatureFailures + stats.fetchFailures + stats.invalidPayloads + stats.ingestionFailures;
          completedOk = failures === 0;
          if (!completedOk) {
            resolutionMessage = 'Worker sweep finished with ingestion, signature, or connectivity failures.';
          }
        }
      } catch (caught) {
        completedOk = false;
        resolutionMessage = caught instanceof Error ? caught.message : String(caught);
      }

      const { error: completeError } = await callUntypedRpc<unknown>('complete_activation_demographic_feed_worker_outbox', {
        target_outbox_id: row.outbox_job_id,
        completed_ok: completedOk,
        resolution_message: resolutionMessage,
      });

      if (completeError) {
        console.error('Failed to complete feed worker outbox job:', completeError);
      }
    }

    toast.success(`Processed ${rows.length} queued feed worker job${rows.length === 1 ? '' : 's'}.`);
    setProcessingFeedOutbox(false);
    await loadFeedData();
  }, [
    canManageFeeds,
    feedBackendUnavailable,
    feedWorkerBackendUnavailable,
    feedAdapters,
    recordFeedWorkerRun,
    fetchFeedAdapterById,
    loadFeedData,
  ]);

  const runFeedWorkerSweep = useCallback(async () => {
    if (!canManageFeeds || feedBackendUnavailable || feedWorkerBackendUnavailable || runningFeedWorkers) return;

    const activeAdaptersWithEndpoints = feedAdapters.filter((adapter) =>
      adapter.is_active && Boolean(adapter.endpoint_url?.trim()));

    if (activeAdaptersWithEndpoints.length === 0) {
      toast.error('At least one active adapter endpoint is required for worker sweep.');
      return;
    }

    setRunningFeedWorkers(true);
    const stats = await runActivationDemographicFeedWorkerSweep({
      adapters: activeAdaptersWithEndpoints,
      recordFeedWorkerRun,
    });
    setRunningFeedWorkers(false);

    await loadFeedData();

    if (stats.signatureFailures || stats.fetchFailures || stats.invalidPayloads || stats.ingestionFailures) {
      toast.warning(
        `Feed worker sweep completed with alerts (${stats.ingested} ingested, ${stats.signatureFailures} signature failures, ${stats.fetchFailures} fetch failures, ${stats.invalidPayloads} payload failures, ${stats.ingestionFailures} ingestion failures).`,
      );
      return;
    }

    toast.success(`Feed worker sweep completed: ${stats.ingested} signed snapshots ingested.`);
  }, [canManageFeeds, feedAdapters, feedBackendUnavailable, feedWorkerBackendUnavailable, loadFeedData, recordFeedWorkerRun, runningFeedWorkers]);

  const escalateFeedWorkerAlertsToPublicExecution = useCallback(async () => {
    if (!canManageFeeds || feedBackendUnavailable || feedWorkerBackendUnavailable) return;

    setEscalatingFeedWorkerPublicExecution(true);

    const { error } = await callUntypedRpc<unknown>('maybe_escalate_activation_feed_worker_exec_page', {
      target_batch_id: null,
      requested_freshness_hours: FEED_WORKER_DEFAULT_FRESHNESS_HOURS,
      escalation_context: {
        source: 'governance_activation_feed_adapters_panel',
      },
    });

    if (error) {
      if (isMissingActivationDemographicFeedWorkerBackend(error)) {
        setFeedWorkerBackendUnavailable(true);
      } else {
        console.error('Failed to escalate activation demographic feed worker alerts:', error);
        toast.error('Could not update the public audit on-call page for feed worker alerts.');
      }
      setEscalatingFeedWorkerPublicExecution(false);
      return;
    }

    toast.success('Public audit on-call page evaluated for activation feed worker alerts.');
    setEscalatingFeedWorkerPublicExecution(false);
    await loadFeedData();
  }, [canManageFeeds, feedBackendUnavailable, feedWorkerBackendUnavailable, loadFeedData]);

  const resolveFeedAlert = useCallback(async (adapterId: string, alertType: ActivationDemographicFeedAlertType | null = null) => {
    if (!canManageFeeds || feedBackendUnavailable || feedWorkerBackendUnavailable) return;

    const resolveKey = `${adapterId}:${alertType ?? 'all'}`;
    setResolvingFeedAlertKey(resolveKey);

    const { error } = await callUntypedRpc<unknown>('resolve_activation_demographic_feed_worker_alerts', {
      target_adapter_id: adapterId,
      target_alert_type: alertType,
    });

    if (error) {
      console.error('Failed to resolve activation demographic feed alert:', {
        adapterId,
        alertType,
        error,
      });
      toast.error('Could not resolve feed worker alert.');
      setResolvingFeedAlertKey(null);
      return;
    }

    toast.success('Feed worker alert resolved.');
    setResolvingFeedAlertKey(null);
    await loadFeedData();
  }, [canManageFeeds, feedBackendUnavailable, feedWorkerBackendUnavailable, loadFeedData]);

  return {
    loadingFeedData,
    feedBackendUnavailable,
    feedWorkerBackendUnavailable,
    canManageFeeds,
    registeringFeedAdapter,
    ingestingSignedFeedSnapshot,
    runningFeedWorkers,
    schedulingFeedWorkerJobs,
    processingFeedOutbox,
    escalatingFeedWorkerPublicExecution,
    pendingFeedOutboxCount,
    resolvingFeedAlertKey,
    openFeedWorkerAlertsCount,
    feedAdapters,
    feedIngestions,
    feedWorkerAlerts,
    feedWorkerSchedulePolicy,
    loadFeedData,
    registerFeedAdapter,
    ingestSignedFeedSnapshot,
    scheduleFeedWorkerJobs,
    processFeedWorkerOutboxQueue,
    runFeedWorkerSweep,
    escalateFeedWorkerAlertsToPublicExecution,
    resolveFeedAlert,
  };
}
