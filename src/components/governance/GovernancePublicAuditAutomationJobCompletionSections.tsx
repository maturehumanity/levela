import { useState } from 'react';
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
import type { Database } from '@/integrations/supabase/types';
import {
  formatGovernancePublicAuditQueueJobStatusLabel,
  type GovernancePublicAuditAnchorExecutionJobBoardRow,
} from '@/lib/governance-public-audit-automation';

interface GovernancePublicAuditAnchorExecutionJobCompletionSectionProps {
  anchorExecutionJobs: GovernancePublicAuditAnchorExecutionJobBoardRow[];
  formatTimestamp: (value: string | null) => string;
  completingAnchorExecutionJob: boolean;
  completeAnchorExecutionJob: (draft: {
    jobId: string;
    completionStatus: 'completed' | 'failed' | 'cancelled';
    immutableReference: string;
    blockHeight: string;
    errorMessage: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditAnchorExecutionJobCompletionSection({
  anchorExecutionJobs,
  formatTimestamp,
  completingAnchorExecutionJob,
  completeAnchorExecutionJob,
}: GovernancePublicAuditAnchorExecutionJobCompletionSectionProps) {
  const [draft, setDraft] = useState({
    jobId: '',
    completionStatus: 'completed' as 'completed' | 'failed' | 'cancelled',
    immutableReference: '',
    blockHeight: '',
    errorMessage: '',
  });

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Complete anchor execution job</p>
      <Select
        value={draft.jobId}
        onValueChange={(value) => setDraft((current) => ({ ...current, jobId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select anchor job" />
        </SelectTrigger>
        <SelectContent>
          {anchorExecutionJobs.slice(0, 40).map((job) => (
            <SelectItem key={job.jobId} value={job.jobId}>
              {formatGovernancePublicAuditQueueJobStatusLabel(job.status)}
              {' '}• {job.adapterName || job.adapterKey || 'adapter'} • {formatTimestamp(job.scheduledAt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={draft.completionStatus}
        onValueChange={(value) => setDraft((current) => ({ ...current, completionStatus: value as typeof current.completionStatus }))}
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
      {draft.completionStatus === 'completed' && (
        <>
          <Input
            value={draft.immutableReference}
            onChange={(event) => setDraft((current) => ({ ...current, immutableReference: event.target.value }))}
            placeholder="Immutable reference"
          />
          <Input
            value={draft.blockHeight}
            onChange={(event) => setDraft((current) => ({ ...current, blockHeight: event.target.value }))}
            placeholder="Block height (optional)"
          />
        </>
      )}
      <Input
        value={draft.errorMessage}
        onChange={(event) => setDraft((current) => ({ ...current, errorMessage: event.target.value }))}
        placeholder="Error message (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={completingAnchorExecutionJob}
        onClick={() => void completeAnchorExecutionJob(draft)}
      >
        {completingAnchorExecutionJob ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save anchor job result
      </Button>
    </div>
  );
}

interface GovernancePublicAuditVerifierJobCompletionSectionProps {
  verifierJobs: Database['public']['Tables']['governance_public_audit_verifier_jobs']['Row'][];
  formatTimestamp: (value: string | null) => string;
  completingVerifierJob: boolean;
  completeVerifierJob: (draft: {
    jobId: string;
    completionStatus: Database['public']['Enums']['governance_public_audit_verifier_job_status'];
    verificationStatus: Database['public']['Enums']['governance_public_audit_verification_status'];
    verificationHash: string;
    proofReference: string;
    errorMessage: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierJobCompletionSection({
  verifierJobs,
  formatTimestamp,
  completingVerifierJob,
  completeVerifierJob,
}: GovernancePublicAuditVerifierJobCompletionSectionProps) {
  const [draft, setDraft] = useState({
    jobId: '',
    completionStatus: 'completed' as 'completed' | 'failed' | 'cancelled',
    verificationStatus: 'verified' as 'verified' | 'mismatch' | 'unreachable',
    verificationHash: '',
    proofReference: '',
    errorMessage: '',
  });

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Complete verifier job</p>
      <Select
        value={draft.jobId}
        onValueChange={(value) => setDraft((current) => ({ ...current, jobId: value }))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select verifier job" />
        </SelectTrigger>
        <SelectContent>
          {verifierJobs.slice(0, 40).map((job) => (
            <SelectItem key={job.id} value={job.id}>
              {formatGovernancePublicAuditQueueJobStatusLabel(job.status)}
              {' '}• {job.batch_id.slice(0, 8)} • {formatTimestamp(job.scheduled_at)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={draft.completionStatus}
        onValueChange={(value) => setDraft((current) => ({ ...current, completionStatus: value as typeof current.completionStatus }))}
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
      {draft.completionStatus === 'completed' && (
        <Select
          value={draft.verificationStatus}
          onValueChange={(value) => setDraft((current) => ({ ...current, verificationStatus: value as typeof current.verificationStatus }))}
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
      )}
      <Input
        value={draft.verificationHash}
        onChange={(event) => setDraft((current) => ({ ...current, verificationHash: event.target.value }))}
        placeholder="Verification hash (optional)"
      />
      <Input
        value={draft.proofReference}
        onChange={(event) => setDraft((current) => ({ ...current, proofReference: event.target.value }))}
        placeholder="Proof reference (optional)"
      />
      <Input
        value={draft.errorMessage}
        onChange={(event) => setDraft((current) => ({ ...current, errorMessage: event.target.value }))}
        placeholder="Error message (optional)"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={completingVerifierJob}
        onClick={() => void completeVerifierJob(draft)}
      >
        {completingVerifierJob ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save verifier job result
      </Button>
    </div>
  );
}
