import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
import type { GovernancePublicAuditAnchorAdapterRow } from '@/lib/governance-public-audit-automation';

interface GovernancePublicAuditAutomationExecutionControlsProps {
  latestBatchId: string | null;
  activeAnchorAdapters: GovernancePublicAuditAnchorAdapterRow[];
  registeringAnchorAdapter: boolean;
  recordingImmutableAnchor: boolean;
  schedulingAnchorExecutionJobs: boolean;
  schedulingVerifierJobs: boolean;
  runningExternalExecutionCycle: boolean;
  drainingExternalExecutionQueue: boolean;
  evaluatingExternalExecutionPaging: boolean;
  onRegisterAnchorAdapter: (draft: {
    adapterKey: string;
    adapterName: string;
    network: string;
    endpointUrl: string;
    attestationScheme: string;
  }) => Promise<void> | void;
  onRecordImmutableAnchor: (draft: {
    adapterId: string;
    network: string;
    immutableReference: string;
    blockHeight: string;
  }) => Promise<void> | void;
  onScheduleAnchorExecutionJobs: (forceReschedule?: boolean) => Promise<void> | void;
  onScheduleVerifierJobs: (forceReschedule?: boolean) => Promise<void> | void;
  onRunExternalExecutionCycle: (forceReschedule?: boolean) => Promise<void> | void;
  onDrainExternalExecutionQueue: (draft: {
    anchorLimit: string;
    verifierLimit: string;
    workerIdentity: string;
  }) => Promise<void> | void;
  onEvaluateExternalExecutionPaging: (autoOpenPages?: boolean) => Promise<void> | void;
}

export function GovernancePublicAuditAutomationExecutionControls({
  latestBatchId,
  activeAnchorAdapters,
  registeringAnchorAdapter,
  recordingImmutableAnchor,
  schedulingAnchorExecutionJobs,
  schedulingVerifierJobs,
  runningExternalExecutionCycle,
  drainingExternalExecutionQueue,
  evaluatingExternalExecutionPaging,
  onRegisterAnchorAdapter,
  onRecordImmutableAnchor,
  onScheduleAnchorExecutionJobs,
  onScheduleVerifierJobs,
  onRunExternalExecutionCycle,
  onDrainExternalExecutionQueue,
  onEvaluateExternalExecutionPaging,
}: GovernancePublicAuditAutomationExecutionControlsProps) {
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
  const [queueDrainDraft, setQueueDrainDraft] = useState({
    anchorLimit: '6',
    verifierLimit: '10',
    workerIdentity: '',
  });

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Anchor adapter registry</p>
        <Input value={adapterDraft.adapterKey} onChange={(event) => setAdapterDraft((current) => ({ ...current, adapterKey: event.target.value }))} placeholder="Adapter key" />
        <Input value={adapterDraft.adapterName} onChange={(event) => setAdapterDraft((current) => ({ ...current, adapterName: event.target.value }))} placeholder="Adapter name" />
        <Input value={adapterDraft.network} onChange={(event) => setAdapterDraft((current) => ({ ...current, network: event.target.value }))} placeholder="Network" />
        <Input value={adapterDraft.endpointUrl} onChange={(event) => setAdapterDraft((current) => ({ ...current, endpointUrl: event.target.value }))} placeholder="Endpoint URL" />
        <Input value={adapterDraft.attestationScheme} onChange={(event) => setAdapterDraft((current) => ({ ...current, attestationScheme: event.target.value }))} placeholder="Attestation scheme" />
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={registeringAnchorAdapter} onClick={() => void onRegisterAnchorAdapter(adapterDraft)}>
          {registeringAnchorAdapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save anchor adapter
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">External execution controls</p>
        <Label className="text-xs">Adapter override for manual anchor</Label>
        <Select value={immutableAnchorDraft.adapterId} onValueChange={(value) => setImmutableAnchorDraft((current) => ({ ...current, adapterId: value }))}>
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
        <Input value={immutableAnchorDraft.network} onChange={(event) => setImmutableAnchorDraft((current) => ({ ...current, network: event.target.value }))} placeholder="Network override (optional)" />
        <Input value={immutableAnchorDraft.immutableReference} onChange={(event) => setImmutableAnchorDraft((current) => ({ ...current, immutableReference: event.target.value }))} placeholder="Immutable reference" />
        <Input value={immutableAnchorDraft.blockHeight} onChange={(event) => setImmutableAnchorDraft((current) => ({ ...current, blockHeight: event.target.value }))} placeholder="Block height (optional)" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full gap-2"
          disabled={!latestBatchId || recordingImmutableAnchor}
          onClick={() => void onRecordImmutableAnchor({
            ...immutableAnchorDraft,
            adapterId: immutableAnchorDraft.adapterId === 'none' ? '' : immutableAnchorDraft.adapterId,
          })}
        >
          {recordingImmutableAnchor ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Record immutable anchor
        </Button>
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={schedulingAnchorExecutionJobs} onClick={() => void onScheduleAnchorExecutionJobs(false)}>
          {schedulingAnchorExecutionJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Schedule anchor execution jobs
        </Button>
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={schedulingVerifierJobs} onClick={() => void onScheduleVerifierJobs(false)}>
          {schedulingVerifierJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Schedule verifier jobs
        </Button>
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={runningExternalExecutionCycle} onClick={() => void onRunExternalExecutionCycle(false)}>
          {runningExternalExecutionCycle ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Run external execution cycle
        </Button>
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={drainingExternalExecutionQueue} onClick={() => void onDrainExternalExecutionQueue(queueDrainDraft)}>
          {drainingExternalExecutionQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Drain ready execution queue
        </Button>
        <Input value={queueDrainDraft.anchorLimit} onChange={(event) => setQueueDrainDraft((current) => ({ ...current, anchorLimit: event.target.value }))} placeholder="Anchor claim limit" />
        <Input value={queueDrainDraft.verifierLimit} onChange={(event) => setQueueDrainDraft((current) => ({ ...current, verifierLimit: event.target.value }))} placeholder="Verifier claim limit" />
        <Input value={queueDrainDraft.workerIdentity} onChange={(event) => setQueueDrainDraft((current) => ({ ...current, workerIdentity: event.target.value }))} placeholder="Worker identity (optional)" />
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={evaluatingExternalExecutionPaging} onClick={() => void onEvaluateExternalExecutionPaging(true)}>
          {evaluatingExternalExecutionPaging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Evaluate paging + route on-call
        </Button>
      </div>
    </div>
  );
}
