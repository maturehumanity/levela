import { useMemo, useState } from 'react';
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
import {
  formatGovernancePublicAuditVerifierMirrorFederationAlertHeading,
  formatGovernancePublicAuditVerifierMirrorFederationAlertSeverityLabel,
} from '@/lib/governance-public-audit-verifiers';
import type { GovernancePublicAuditVerifierMirrorFederationAlertBoardRow } from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationWorkerAlertControlsProps {
  federationAlertBoard: GovernancePublicAuditVerifierMirrorFederationAlertBoardRow[];
  recordingFederationWorkerRun: boolean;
  openingFederationAlert: boolean;
  resolvingFederationAlert: boolean;
  recordFederationWorkerRun: (draft: {
    runScope: 'onboarding_sweep' | 'operator_health_audit' | 'diversity_audit' | 'package_distribution_verification' | 'manual';
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredRequestCount: string;
    approvedRequestCount: string;
    onboardedRequestCount: string;
    openAlertCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  openFederationAlert: (draft: {
    alertKey: string;
    severity: 'info' | 'warning' | 'critical';
    alertScope: string;
    alertMessage: string;
  }) => Promise<void> | void;
  resolveFederationAlert: (draft: {
    alertId: string;
    resolutionNotes: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierMirrorFederationWorkerAlertControls({
  federationAlertBoard,
  recordingFederationWorkerRun,
  openingFederationAlert,
  resolvingFederationAlert,
  recordFederationWorkerRun,
  openFederationAlert,
  resolveFederationAlert,
}: GovernancePublicAuditVerifierMirrorFederationWorkerAlertControlsProps) {
  const [workerRunDraft, setWorkerRunDraft] = useState({
    runScope: 'manual' as 'onboarding_sweep' | 'operator_health_audit' | 'diversity_audit' | 'package_distribution_verification' | 'manual',
    runStatus: 'ok' as 'ok' | 'degraded' | 'failed',
    discoveredRequestCount: '',
    approvedRequestCount: '',
    onboardedRequestCount: '',
    openAlertCount: '',
    errorMessage: '',
  });
  const [alertDraft, setAlertDraft] = useState({
    alertKey: '',
    severity: 'warning' as 'info' | 'warning' | 'critical',
    alertScope: 'manual',
    alertMessage: '',
  });
  const [distributionAlertTemplate, setDistributionAlertTemplate] = useState<'none' | 'stale_package' | 'bad_signature' | 'policy_mismatch'>('none');
  const [resolveAlertDraft, setResolveAlertDraft] = useState({
    alertId: '',
    resolutionNotes: '',
  });

  const openAlerts = useMemo(
    () => federationAlertBoard.filter((alert) => alert.alertStatus === 'open' || alert.alertStatus === 'acknowledged'),
    [federationAlertBoard],
  );

  return (
    <>
      <Label className="pt-1 text-xs">Record worker run</Label>
      <Select value={workerRunDraft.runScope} onValueChange={(value) => setWorkerRunDraft((current) => ({ ...current, runScope: value as typeof current.runScope }))}>
        <SelectTrigger>
          <SelectValue placeholder="Run scope" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="onboarding_sweep">Onboarding sweep</SelectItem>
          <SelectItem value="operator_health_audit">Operator health audit</SelectItem>
          <SelectItem value="diversity_audit">Diversity audit</SelectItem>
          <SelectItem value="package_distribution_verification">Package distribution verification</SelectItem>
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
      <Input value={workerRunDraft.discoveredRequestCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, discoveredRequestCount: event.target.value }))} placeholder="Discovered request count" />
      <Input value={workerRunDraft.approvedRequestCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, approvedRequestCount: event.target.value }))} placeholder="Approved request count" />
      <Input value={workerRunDraft.onboardedRequestCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, onboardedRequestCount: event.target.value }))} placeholder="Onboarded request count" />
      <Input value={workerRunDraft.openAlertCount} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, openAlertCount: event.target.value }))} placeholder="Open alert count" />
      <Input value={workerRunDraft.errorMessage} onChange={(event) => setWorkerRunDraft((current) => ({ ...current, errorMessage: event.target.value }))} placeholder="Error message (optional)" />
      <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={recordingFederationWorkerRun} onClick={() => void recordFederationWorkerRun(workerRunDraft)}>
        {recordingFederationWorkerRun ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save worker run
      </Button>

      <Label className="pt-1 text-xs">Open federation alert</Label>
      <Select
        value={distributionAlertTemplate}
        onValueChange={(value) => {
          const next = value as typeof distributionAlertTemplate;
          setDistributionAlertTemplate(next);
          if (next === 'none') return;
          if (next === 'stale_package') {
            setAlertDraft({
              alertKey: 'verifier_federation_distribution_stale_package',
              severity: 'critical',
              alertScope: 'federation_distribution_stale_package',
              alertMessage: 'Latest federation distribution package is stale or missing (manual drill).',
            });
            return;
          }
          if (next === 'bad_signature') {
            setAlertDraft({
              alertKey: 'verifier_federation_distribution_bad_signature',
              severity: 'critical',
              alertScope: 'federation_distribution_bad_signature',
              alertMessage: 'Malformed or unsupported federation package signature detected (manual drill).',
            });
            return;
          }
          setAlertDraft({
            alertKey: 'verifier_federation_distribution_policy_mismatch',
            severity: 'critical',
            alertScope: 'federation_distribution_policy_mismatch',
            alertMessage: 'Federation distribution policy mismatch vs captured package state (manual drill).',
          });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Distribution alert template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Custom (no template)</SelectItem>
          <SelectItem value="stale_package">Distribution: stale / missing package</SelectItem>
          <SelectItem value="bad_signature">Distribution: bad signature</SelectItem>
          <SelectItem value="policy_mismatch">Distribution: policy mismatch</SelectItem>
        </SelectContent>
      </Select>
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
        disabled={openingFederationAlert || !alertDraft.alertKey.trim() || !alertDraft.alertMessage.trim()}
        onClick={() => void openFederationAlert(alertDraft)}
      >
        {openingFederationAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Open federation alert
      </Button>

      <Label className="pt-1 text-xs">Resolve federation alert</Label>
      <Select value={resolveAlertDraft.alertId} onValueChange={(value) => setResolveAlertDraft((current) => ({ ...current, alertId: value }))}>
        <SelectTrigger>
          <SelectValue placeholder="Select open alert" />
        </SelectTrigger>
        <SelectContent>
          {openAlerts.map((alert) => (
            <SelectItem key={alert.alertId} value={alert.alertId}>
              {formatGovernancePublicAuditVerifierMirrorFederationAlertHeading(alert)}
              {' '}• {formatGovernancePublicAuditVerifierMirrorFederationAlertSeverityLabel(alert.severity)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={resolveAlertDraft.resolutionNotes} onChange={(event) => setResolveAlertDraft((current) => ({ ...current, resolutionNotes: event.target.value }))} placeholder="Resolution notes (optional)" />
      <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={resolvingFederationAlert || !resolveAlertDraft.alertId} onClick={() => void resolveFederationAlert(resolveAlertDraft)}>
        {resolvingFederationAlert ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Resolve alert
      </Button>
    </>
  );
}
