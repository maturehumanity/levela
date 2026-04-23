import { useMemo, useState } from 'react';
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
import {
  formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel,
  formatGovernancePublicAuditVerifierMirrorProbeJobLifecycleStatusLabel,
  type GovernancePublicAuditVerifierMirrorProbeJobBoardRow,
  type GovernancePublicAuditVerifierMirrorProbeJobSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorProbeJobsCardProps {
  canManageMirrorProduction: boolean;
  schedulingProbeJobs: boolean;
  completingProbeJob: boolean;
  probeJobSummary: GovernancePublicAuditVerifierMirrorProbeJobSummary | null;
  probeJobs: GovernancePublicAuditVerifierMirrorProbeJobBoardRow[];
  formatTimestamp: (value: string | null) => string;
  scheduleProbeJobs: (forceReschedule: boolean) => Promise<void> | void;
  completeProbeJob: (draft: {
    jobId: string;
    completionStatus: 'completed' | 'failed' | 'cancelled';
    checkStatus: 'ok' | 'degraded' | 'failed';
    observedLatencyMs: string;
    observedBatchHash: string;
    errorMessage: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierMirrorProbeJobsCard({
  canManageMirrorProduction,
  schedulingProbeJobs,
  completingProbeJob,
  probeJobSummary,
  probeJobs,
  formatTimestamp,
  scheduleProbeJobs,
  completeProbeJob,
}: GovernancePublicAuditVerifierMirrorProbeJobsCardProps) {
  const [probeCompletionDraft, setProbeCompletionDraft] = useState({
    jobId: '',
    completionStatus: 'completed' as 'completed' | 'failed' | 'cancelled',
    checkStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    observedLatencyMs: '',
    observedBatchHash: '',
    errorMessage: '',
  });

  const selectableProbeJobs = useMemo(
    () => probeJobs.filter((job) => job.status === 'pending' || job.status === 'running').slice(0, 50),
    [probeJobs],
  );

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
      <p className="font-medium text-foreground">Autonomous probe jobs</p>
      {probeJobSummary && (
        <p className="text-muted-foreground">
          Failed (24h): {probeJobSummary.failedLookbackCount} • Completed (24h): {probeJobSummary.completedLookbackCount}
        </p>
      )}
      {canManageMirrorProduction && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={schedulingProbeJobs}
            onClick={() => void scheduleProbeJobs(false)}
          >
            {schedulingProbeJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Schedule
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={schedulingProbeJobs}
            onClick={() => void scheduleProbeJobs(true)}
          >
            {schedulingProbeJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reschedule
          </Button>
        </div>
      )}

      {canManageMirrorProduction && (
        <>
          <Select
            value={probeCompletionDraft.jobId}
            onValueChange={(value) => setProbeCompletionDraft((current) => ({ ...current, jobId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select probe job" />
            </SelectTrigger>
            <SelectContent>
              {selectableProbeJobs.map((job) => (
                <SelectItem key={job.jobId} value={job.jobId}>
                  {formatGovernancePublicAuditVerifierMirrorProbeJobLifecycleStatusLabel(job.status)}
                  {' '}• {job.mirrorLabel || job.mirrorKey} • {formatTimestamp(job.scheduledAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={probeCompletionDraft.completionStatus}
            onValueChange={(value) => setProbeCompletionDraft((current) => ({ ...current, completionStatus: value as typeof current.completionStatus }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Completion status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {probeCompletionDraft.completionStatus === 'completed' && (
            <Select
              value={probeCompletionDraft.checkStatus}
              onValueChange={(value) => setProbeCompletionDraft((current) => ({ ...current, checkStatus: value as typeof current.checkStatus }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Mirror health status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Input
            value={probeCompletionDraft.observedLatencyMs}
            onChange={(event) => setProbeCompletionDraft((current) => ({ ...current, observedLatencyMs: event.target.value }))}
            placeholder="Observed latency ms (optional)"
          />
          <Input
            value={probeCompletionDraft.observedBatchHash}
            onChange={(event) => setProbeCompletionDraft((current) => ({ ...current, observedBatchHash: event.target.value }))}
            placeholder="Observed batch hash (optional)"
          />
          <Input
            value={probeCompletionDraft.errorMessage}
            onChange={(event) => setProbeCompletionDraft((current) => ({ ...current, errorMessage: event.target.value }))}
            placeholder="Error message (optional)"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={completingProbeJob || !probeCompletionDraft.jobId}
            onClick={() => void completeProbeJob(probeCompletionDraft)}
          >
            {completingProbeJob ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save probe job result
          </Button>
        </>
      )}

      <div className="space-y-1 text-muted-foreground">
        {probeJobs.slice(0, 4).map((job) => (
          <p key={job.jobId}>
            {formatGovernancePublicAuditVerifierMirrorProbeJobLifecycleStatusLabel(job.status)}
            {' '}• {job.mirrorLabel || job.mirrorKey} • {formatTimestamp(job.scheduledAt)}
            {job.status === 'completed' && job.observedCheckStatus !== 'unknown'
              ? ` • Mirror check ${formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel(job.observedCheckStatus)}`
              : ''}
          </p>
        ))}
      </div>
    </div>
  );
}
