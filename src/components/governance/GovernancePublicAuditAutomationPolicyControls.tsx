import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  GovernancePublicAuditExternalExecutionPageBoardRow,
  GovernancePublicAuditExternalExecutionPolicySummary,
} from '@/lib/governance-public-audit-automation';

interface GovernancePublicAuditAutomationPolicyControlsProps {
  externalExecutionPolicy: GovernancePublicAuditExternalExecutionPolicySummary | null;
  externalExecutionPages: GovernancePublicAuditExternalExecutionPageBoardRow[];
  savingExternalExecutionPolicy: boolean;
  resolvingExternalExecutionPage: boolean;
  formatTimestamp: (value: string | null) => string;
  onSaveExternalExecutionPolicy: (draft: {
    claimTtlMinutes: string;
    anchorMaxAttempts: string;
    verifierMaxAttempts: string;
    retryBaseDelayMinutes: string;
    retryMaxDelayMinutes: string;
    pagingEnabled: boolean;
    pagingStalePendingMinutes: string;
    pagingFailureSharePercent: string;
    oncallChannel: string;
    oncallWebhookUrl: string;
  }) => Promise<void> | void;
  onResolveExternalExecutionPage: (targetPageId: string, resolutionNotes: string) => Promise<void> | void;
}

export function GovernancePublicAuditAutomationPolicyControls({
  externalExecutionPolicy,
  externalExecutionPages,
  savingExternalExecutionPolicy,
  resolvingExternalExecutionPage,
  formatTimestamp,
  onSaveExternalExecutionPolicy,
  onResolveExternalExecutionPage,
}: GovernancePublicAuditAutomationPolicyControlsProps) {
  const [policyDraft, setPolicyDraft] = useState({
    claimTtlMinutes: '10',
    anchorMaxAttempts: '5',
    verifierMaxAttempts: '5',
    retryBaseDelayMinutes: '5',
    retryMaxDelayMinutes: '120',
    pagingEnabled: true,
    pagingStalePendingMinutes: '30',
    pagingFailureSharePercent: '25',
    oncallChannel: 'public_audit_ops',
    oncallWebhookUrl: '',
  });
  const [pageResolutionNotes, setPageResolutionNotes] = useState('');

  useEffect(() => {
    if (!externalExecutionPolicy) return;
    setPolicyDraft({
      claimTtlMinutes: String(externalExecutionPolicy.claimTtlMinutes),
      anchorMaxAttempts: String(externalExecutionPolicy.anchorMaxAttempts),
      verifierMaxAttempts: String(externalExecutionPolicy.verifierMaxAttempts),
      retryBaseDelayMinutes: String(externalExecutionPolicy.retryBaseDelayMinutes),
      retryMaxDelayMinutes: String(externalExecutionPolicy.retryMaxDelayMinutes),
      pagingEnabled: externalExecutionPolicy.pagingEnabled,
      pagingStalePendingMinutes: String(externalExecutionPolicy.pagingStalePendingMinutes),
      pagingFailureSharePercent: String(externalExecutionPolicy.pagingFailureSharePercent),
      oncallChannel: externalExecutionPolicy.oncallChannel,
      oncallWebhookUrl: externalExecutionPolicy.oncallWebhookUrl ?? '',
    });
  }, [externalExecutionPolicy]);

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-2">
      <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Retry + paging policy</p>
        <Input value={policyDraft.claimTtlMinutes} onChange={(event) => setPolicyDraft((current) => ({ ...current, claimTtlMinutes: event.target.value }))} placeholder="Claim TTL minutes" />
        <Input value={policyDraft.anchorMaxAttempts} onChange={(event) => setPolicyDraft((current) => ({ ...current, anchorMaxAttempts: event.target.value }))} placeholder="Anchor max attempts" />
        <Input value={policyDraft.verifierMaxAttempts} onChange={(event) => setPolicyDraft((current) => ({ ...current, verifierMaxAttempts: event.target.value }))} placeholder="Verifier max attempts" />
        <Input value={policyDraft.retryBaseDelayMinutes} onChange={(event) => setPolicyDraft((current) => ({ ...current, retryBaseDelayMinutes: event.target.value }))} placeholder="Retry base delay minutes" />
        <Input value={policyDraft.retryMaxDelayMinutes} onChange={(event) => setPolicyDraft((current) => ({ ...current, retryMaxDelayMinutes: event.target.value }))} placeholder="Retry max delay minutes" />
        <Input value={policyDraft.pagingStalePendingMinutes} onChange={(event) => setPolicyDraft((current) => ({ ...current, pagingStalePendingMinutes: event.target.value }))} placeholder="Paging stale pending minutes" />
        <Input value={policyDraft.pagingFailureSharePercent} onChange={(event) => setPolicyDraft((current) => ({ ...current, pagingFailureSharePercent: event.target.value }))} placeholder="Paging failure share percent" />
        <Input value={policyDraft.oncallChannel} onChange={(event) => setPolicyDraft((current) => ({ ...current, oncallChannel: event.target.value }))} placeholder="On-call channel" />
        <div
          className="space-y-1"
          data-build-key="governancePublicAuditAutomationPagingWebhookField"
          data-build-label="Optional HTTPS paging webhook URL"
        >
          <p className="text-xs text-muted-foreground">
            Optional HTTPS URL for automatic POST when an on-call execution page opens (requires pg_net on the database). Leave blank to disable.
          </p>
          <Input
            value={policyDraft.oncallWebhookUrl}
            onChange={(event) => setPolicyDraft((current) => ({ ...current, oncallWebhookUrl: event.target.value }))}
            placeholder="https://example.com/your-webhook"
            autoComplete="off"
          />
        </div>
        <Button type="button" size="sm" variant={policyDraft.pagingEnabled ? 'default' : 'outline'} className="w-full" onClick={() => setPolicyDraft((current) => ({ ...current, pagingEnabled: !current.pagingEnabled }))}>
          Paging {policyDraft.pagingEnabled ? 'enabled' : 'disabled'}
        </Button>
        <Button type="button" size="sm" variant="outline" className="w-full gap-2" disabled={savingExternalExecutionPolicy} onClick={() => void onSaveExternalExecutionPolicy(policyDraft)}>
          {savingExternalExecutionPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save external execution policy
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">On-call page board</p>
        {externalExecutionPages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No execution pages for this batch.</p>
        ) : (
          <div className="space-y-1.5">
            {externalExecutionPages.slice(0, 8).map((page) => (
              <div key={page.pageId} className="rounded border border-border/60 bg-background/60 p-2 text-xs">
                <p className="font-medium text-foreground">
                  {page.severity.toUpperCase()} · {page.pageStatus}
                </p>
                <p className="mt-1 text-muted-foreground">{page.pageMessage}</p>
                <p className="mt-1 text-muted-foreground">
                  {page.oncallChannel} · Opened {formatTimestamp(page.openedAt)}
                </p>
                {page.pageStatus !== 'resolved' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 w-full gap-2"
                    disabled={resolvingExternalExecutionPage}
                    onClick={() => void onResolveExternalExecutionPage(page.pageId, pageResolutionNotes)}
                  >
                    {resolvingExternalExecutionPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Resolve page
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Input value={pageResolutionNotes} onChange={(event) => setPageResolutionNotes(event.target.value)} placeholder="Resolution notes for page closes" />
      </div>
    </div>
  );
}
