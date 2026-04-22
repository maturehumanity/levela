import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  GovernanceProposalGuardianRelayAlertBoardRow,
  GovernanceProposalGuardianRelayOperationsSummary,
  GovernanceProposalGuardianRelayWorkerRunBoardRow,
} from '@/lib/governance-guardian-relays';

interface GovernanceGuardianRelayOpsControlsProps {
  relayOperationsSummary: GovernanceProposalGuardianRelayOperationsSummary | null;
  relayAlertBoardRows: GovernanceProposalGuardianRelayAlertBoardRow[];
  relayWorkerRunBoardRows: GovernanceProposalGuardianRelayWorkerRunBoardRow[];
  savingRelayOpsRequirement: boolean;
  recordingRelayWorkerRun: boolean;
  openingRelayAlert: boolean;
  resolvingRelayAlert: boolean;
  formatTimestamp: (value: string | null) => string;
  onSaveRelayOpsRequirement: (draft: {
    requireTrustMinimizedQuorum: boolean;
    requireRelayOpsReadiness: boolean;
    maxOpenCriticalRelayAlerts: string;
    relayAttestationSlaMinutes: string;
  }) => Promise<void> | void;
  onRecordRelayWorkerRun: (draft: {
    runScope: 'attestation_sweep' | 'diversity_audit' | 'manifest_capture' | 'manual';
    runStatus: 'ok' | 'degraded' | 'failed';
    processedSignerCount: string;
    staleSignerCount: string;
    openAlertCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  onOpenRelayAlert: (draft: {
    alertKey: string;
    severity: 'info' | 'warning' | 'critical';
    alertScope: string;
    alertMessage: string;
  }) => Promise<void> | void;
  onResolveRelayAlert: (draft: {
    alertId: string;
    resolutionNotes: string;
  }) => Promise<void> | void;
}

export function GovernanceGuardianRelayOpsControls({
  relayOperationsSummary,
  relayAlertBoardRows,
  relayWorkerRunBoardRows,
  savingRelayOpsRequirement,
  recordingRelayWorkerRun,
  openingRelayAlert,
  resolvingRelayAlert,
  formatTimestamp,
  onSaveRelayOpsRequirement,
  onRecordRelayWorkerRun,
  onOpenRelayAlert,
  onResolveRelayAlert,
}: GovernanceGuardianRelayOpsControlsProps) {
  const [opsRequirementDraft, setOpsRequirementDraft] = useState({
    requireTrustMinimizedQuorum: false,
    requireRelayOpsReadiness: false,
    maxOpenCriticalRelayAlerts: '0',
    relayAttestationSlaMinutes: '120',
  });
  const [workerRunDraft, setWorkerRunDraft] = useState({
    runScope: 'manual' as 'attestation_sweep' | 'diversity_audit' | 'manifest_capture' | 'manual',
    runStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    processedSignerCount: '',
    staleSignerCount: '',
    openAlertCount: '',
    errorMessage: '',
  });
  const [alertDraft, setAlertDraft] = useState({
    alertKey: '',
    severity: 'warning' as 'info' | 'warning' | 'critical',
    alertScope: 'manual',
    alertMessage: '',
  });
  const [resolveAlertDraft, setResolveAlertDraft] = useState({
    alertId: '',
    resolutionNotes: '',
  });

  const openRelayAlerts = useMemo(
    () => relayAlertBoardRows.filter((alert) => alert.alertStatus === 'open' || alert.alertStatus === 'acknowledged'),
    [relayAlertBoardRows],
  );

  useEffect(() => {
    if (!relayOperationsSummary) return;
    setOpsRequirementDraft({
      requireTrustMinimizedQuorum: relayOperationsSummary.requireTrustMinimizedQuorum,
      requireRelayOpsReadiness: relayOperationsSummary.requireRelayOpsReadiness,
      maxOpenCriticalRelayAlerts: String(relayOperationsSummary.maxOpenCriticalRelayAlerts),
      relayAttestationSlaMinutes: String(relayOperationsSummary.relayAttestationSlaMinutes),
    });
  }, [relayOperationsSummary]);

  return (
    <>
      {relayOperationsSummary && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5 text-xs">
          <p className="font-medium text-foreground">Relay operations hardening</p>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={relayOperationsSummary.trustMinimizedQuorumMet
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
            >
              Trust-minimized quorum {relayOperationsSummary.trustMinimizedQuorumMet ? 'met' : 'pending'}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Stale signers {relayOperationsSummary.staleSignerCount}/{relayOperationsSummary.externalApprovalCount}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              Critical alerts {relayOperationsSummary.openCriticalAlertCount}/{relayOperationsSummary.maxOpenCriticalRelayAlerts}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              SLA {relayOperationsSummary.relayAttestationSlaMinutes}m
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Last worker run {formatTimestamp(relayOperationsSummary.lastWorkerRunAt)} • {relayOperationsSummary.lastWorkerRunStatus}
          </p>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ops requirements</p>
          <Select
            value={opsRequirementDraft.requireTrustMinimizedQuorum ? 'yes' : 'no'}
            onValueChange={(value) => setOpsRequirementDraft((current) => ({ ...current, requireTrustMinimizedQuorum: value === 'yes' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Require trust-minimized quorum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Require trust-minimized quorum</SelectItem>
              <SelectItem value="no">Allow without trust-minimized quorum</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={opsRequirementDraft.requireRelayOpsReadiness ? 'yes' : 'no'}
            onValueChange={(value) => setOpsRequirementDraft((current) => ({ ...current, requireRelayOpsReadiness: value === 'yes' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Require relay ops readiness" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Require relay ops readiness</SelectItem>
              <SelectItem value="no">Allow without relay ops readiness</SelectItem>
            </SelectContent>
          </Select>
          <Input value={opsRequirementDraft.maxOpenCriticalRelayAlerts} onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, maxOpenCriticalRelayAlerts: event.target.value }))} placeholder="Max open critical alerts" />
          <Input value={opsRequirementDraft.relayAttestationSlaMinutes} onChange={(event) => setOpsRequirementDraft((current) => ({ ...current, relayAttestationSlaMinutes: event.target.value }))} placeholder="Relay attestation SLA minutes" />
          <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={savingRelayOpsRequirement} onClick={() => void onSaveRelayOpsRequirement(opsRequirementDraft)}>
            {savingRelayOpsRequirement ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save relay ops requirements
          </Button>
          <p className="text-xs text-muted-foreground">
            Worker runs tracked: {relayWorkerRunBoardRows.length} • Alerts tracked: {relayAlertBoardRows.length}
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Record worker run</p>
          <Select value={workerRunDraft.runScope} onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runScope: value as typeof current.runScope }))}>
            <SelectTrigger>
              <SelectValue placeholder="Run scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attestation_sweep">Attestation sweep</SelectItem>
              <SelectItem value="diversity_audit">Diversity audit</SelectItem>
              <SelectItem value="manifest_capture">Manifest capture</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={workerRunDraft.runStatus} onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runStatus: value as typeof current.runStatus }))}>
            <SelectTrigger>
              <SelectValue placeholder="Run status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Input value={workerRunDraft.processedSignerCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, processedSignerCount: event.target.value }))} placeholder="Processed signer count" />
          <Input value={workerRunDraft.staleSignerCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, staleSignerCount: event.target.value }))} placeholder="Stale signer count" />
          <Input value={workerRunDraft.openAlertCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, openAlertCount: event.target.value }))} placeholder="Open alert count" />
          <Input value={workerRunDraft.errorMessage} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, errorMessage: event.target.value }))} placeholder="Error message (optional)" />
          <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={recordingRelayWorkerRun} onClick={() => void onRecordRelayWorkerRun(workerRunDraft)}>
            {recordingRelayWorkerRun ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save worker run
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Open relay alert</p>
          <Input value={alertDraft.alertKey} onChange={(event) => setAlertDraft((current) => ({ ...current, alertKey: event.target.value }))} placeholder="Alert key" />
          <Select value={alertDraft.severity} onValueChange={(value) => setAlertDraft((current) => ({ ...current, severity: value as typeof current.severity }))}>
            <SelectTrigger>
              <SelectValue placeholder="Alert severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Input value={alertDraft.alertScope} onChange={(event) => setAlertDraft((current) => ({ ...current, alertScope: event.target.value }))} placeholder="Alert scope" />
          <Input value={alertDraft.alertMessage} onChange={(event) => setAlertDraft((current) => ({ ...current, alertMessage: event.target.value }))} placeholder="Alert message" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={openingRelayAlert || !alertDraft.alertKey.trim() || !alertDraft.alertMessage.trim()}
            onClick={() => void onOpenRelayAlert(alertDraft)}
          >
            {openingRelayAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Open relay alert
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Resolve relay alert</p>
          <Select value={resolveAlertDraft.alertId} onValueChange={(value) => setResolveAlertDraft((current) => ({ ...current, alertId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select open alert" />
            </SelectTrigger>
            <SelectContent>
              {openRelayAlerts.map((alert) => (
                <SelectItem key={alert.alertId} value={alert.alertId}>
                  {alert.alertKey} • {alert.severity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={resolveAlertDraft.resolutionNotes} onChange={(event) => setResolveAlertDraft((current) => ({ ...current, resolutionNotes: event.target.value }))} placeholder="Resolution notes (optional)" />
          <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={resolvingRelayAlert || !resolveAlertDraft.alertId} onClick={() => void onResolveRelayAlert(resolveAlertDraft)}>
            {resolvingRelayAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Resolve relay alert
          </Button>
          <div className="space-y-1 text-xs text-muted-foreground">
            {relayAlertBoardRows.slice(0, 4).map((alert) => (
              <p key={alert.alertId}>
                {alert.alertKey} • {alert.severity} • {alert.alertStatus} • {formatTimestamp(alert.openedAt)}
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
