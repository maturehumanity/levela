import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GovernancePublicAuditVerifierPanel } from '@/components/governance/GovernancePublicAuditVerifierPanel';
import { GovernancePublicAuditAutomationPanel } from '@/components/governance/GovernancePublicAuditAutomationPanel';
import type {
  GovernancePublicAuditBatchRow,
  GovernancePublicAuditChainStatus,
} from '@/lib/governance-public-audit';
import { summarizeGovernancePublicAuditBatch } from '@/lib/governance-public-audit';

interface GovernancePublicAuditAnchoringCardProps {
  batches: GovernancePublicAuditBatchRow[];
  chainStatus: GovernancePublicAuditChainStatus | null;
  loading: boolean;
  backendUnavailable: boolean;
  creatingBatch: boolean;
  recordingAnchor: boolean;
  anchorNetwork: string;
  anchorReference: string;
  formatTimestamp: (value: string | null) => string;
  onCreateBatch: () => void;
  onRecordAnchor: () => void;
  onAnchorNetworkChange: (next: string) => void;
  onAnchorReferenceChange: (next: string) => void;
}

export function GovernancePublicAuditAnchoringCard({
  batches,
  chainStatus,
  loading,
  backendUnavailable,
  creatingBatch,
  recordingAnchor,
  anchorNetwork,
  anchorReference,
  formatTimestamp,
  onCreateBatch,
  onRecordAnchor,
  onAnchorNetworkChange,
  onAnchorReferenceChange,
}: GovernancePublicAuditAnchoringCardProps) {
  const latestBatch = batches[0] || null;

  return (
    <Card id="stewardship-public-audit-tools" className="scroll-mt-24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Public Audit Anchoring</h2>
          <p className="text-sm text-muted-foreground">
            Capture append-only governance audit batches and record external anchor references.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onCreateBatch}
          disabled={backendUnavailable || loading || creatingBatch}
        >
          {creatingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Capture audit batch
        </Button>
      </div>

      {backendUnavailable ? (
        <p className="mt-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Public audit anchoring tables are not available in this environment yet.
        </p>
      ) : loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading public audit batches...
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {chainStatus && (
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={chainStatus.valid
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/20 bg-destructive/10 text-destructive'}
              >
                {chainStatus.valid ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : <ShieldX className="mr-1 h-3.5 w-3.5" />}
                Chain {chainStatus.valid ? 'valid' : 'invalid'}
              </Badge>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                Checked {chainStatus.checkedBatchCount} batches
              </Badge>
              <Badge
                variant="outline"
                className={chainStatus.linkValid
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/20 bg-destructive/10 text-destructive'}
              >
                Link {chainStatus.linkValid ? 'ok' : 'broken'}
              </Badge>
              <Badge
                variant="outline"
                className={chainStatus.hashValid
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/20 bg-destructive/10 text-destructive'}
              >
                Hash {chainStatus.hashValid ? 'ok' : 'mismatch'}
              </Badge>
            </div>
          )}

          {latestBatch && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Latest batch</p>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Index:</span> {latestBatch.batch_index}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Captured:</span> {formatTimestamp(latestBatch.created_at)}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Events:</span> {latestBatch.event_count}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Hash:</span> {summarizeGovernancePublicAuditBatch(latestBatch).hashPreview}
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <input
                  value={anchorNetwork}
                  onChange={(event) => onAnchorNetworkChange(event.target.value)}
                  placeholder="Anchor network"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  value={anchorReference}
                  onChange={(event) => onAnchorReferenceChange(event.target.value)}
                  placeholder="Anchor reference"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
                />
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={onRecordAnchor}
                  disabled={recordingAnchor || !anchorReference.trim()}
                >
                  {recordingAnchor ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Record latest anchor
                </Button>
              </div>
            </div>
          )}

          <GovernancePublicAuditVerifierPanel
            latestBatchId={latestBatch?.id || null}
            formatTimestamp={formatTimestamp}
          />
          <GovernancePublicAuditAutomationPanel
            latestBatchId={latestBatch?.id || null}
            formatTimestamp={formatTimestamp}
          />

          <div className="space-y-2">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public audit batches captured yet.</p>
            ) : (
              batches.map((batch) => {
                const summary = summarizeGovernancePublicAuditBatch(batch);
                return (
                  <div key={batch.id} className="rounded-lg border border-border/60 bg-card p-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                          #{batch.batch_index}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={summary.anchored
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
                        >
                          {summary.anchored ? 'Anchored' : 'Pending anchor'}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">{formatTimestamp(batch.created_at)}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Events: <span className="text-foreground">{summary.eventCount}</span> | Hash: <span className="text-foreground">{summary.hashPreview}</span>
                    </p>
                    {batch.anchor_reference && (
                      <p className="mt-1 text-muted-foreground">
                        Anchor: <span className="text-foreground">{batch.anchor_network || 'external'} • {batch.anchor_reference}</span>
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
