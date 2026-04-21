import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type {
  GovernanceProposalGuardianRelayAttestationAuditRow,
  GovernanceProposalGuardianRelayRecentAuditRow,
} from '@/lib/governance-guardian-relays';

interface GovernanceGuardianRelayAuditSectionProps {
  canManageGuardianRelays: boolean;
  relayAttestationAuditRows: GovernanceProposalGuardianRelayAttestationAuditRow[];
  relayRecentAuditReports: GovernanceProposalGuardianRelayRecentAuditRow[];
  capturingRelayAuditReport: boolean;
  onCaptureRelayAuditReport: (auditNotes: string) => Promise<void> | void;
  formatTimestamp: (value: string | null) => string;
}

function getHealthBadgeClassName(status: GovernanceProposalGuardianRelayAttestationAuditRow['recentHealthStatus']) {
  switch (status) {
    case 'healthy':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'degraded':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'critical':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function GovernanceGuardianRelayAuditSection({
  canManageGuardianRelays,
  relayAttestationAuditRows,
  relayRecentAuditReports,
  capturingRelayAuditReport,
  onCaptureRelayAuditReport,
  formatTimestamp,
}: GovernanceGuardianRelayAuditSectionProps) {
  const [auditNotes, setAuditNotes] = useState('');

  return (
    <>
      {relayAttestationAuditRows.length > 0 && (
        <div className="space-y-1 rounded-lg border border-border/60 bg-card p-2.5 text-xs">
          <p className="font-medium text-foreground">Relay attestation health (7d)</p>
          {relayAttestationAuditRows.slice(0, 8).map((row) => (
            <div key={row.relayId} className="rounded-md border border-border/60 bg-background p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{row.relayLabel || row.relayKey}</p>
                <Badge variant="outline" className={getHealthBadgeClassName(row.recentHealthStatus)}>
                  {row.recentHealthStatus}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {row.relayRegionCode} • {row.relayInfrastructureProvider} • {row.relayOperatorLabel} • {row.relayTrustDomain}
              </p>
              <p className="text-muted-foreground">
                Recent health {typeof row.recentHealthScore === 'number' ? `${row.recentHealthScore}%` : 'n/a'} • failures {row.recentFailureCount}/{row.recentAttestationCount} • total verified {row.verifiedCount}
              </p>
            </div>
          ))}
        </div>
      )}

      {canManageGuardianRelays && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Formal quorum audit snapshots</p>
          <Textarea
            value={auditNotes}
            onChange={(event) => setAuditNotes(event.target.value)}
            rows={2}
            placeholder="Audit notes (optional)"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={capturingRelayAuditReport}
            onClick={() => void onCaptureRelayAuditReport(auditNotes)}
          >
            {capturingRelayAuditReport ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Capture relay audit snapshot
          </Button>

          {relayRecentAuditReports.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {relayRecentAuditReports.slice(0, 4).map((report) => (
                <p key={report.reportId}>
                  {report.overallDiversityMet ? 'Diversity met' : 'Diversity pending'} • {report.relayQuorumMet ? 'Quorum met' : 'Quorum pending'} • {formatTimestamp(report.capturedAt)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
