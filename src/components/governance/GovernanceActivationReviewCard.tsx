import { useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { toActivationScopeKey, type ActivationDecisionRow, type ActivationDemographicSnapshotRow, type ActivationEvidenceRow, type ActivationReviewDecision, type ActivationScopeType, type ActivationThresholdReviewRow } from '@/lib/governance-activation-review';
import type { ActivationDemographicSnapshotDraft } from '@/lib/use-governance-activation-review';
import { GovernanceActivationReviewScopeCard } from '@/components/governance/GovernanceActivationReviewScopeCard';
import { GovernanceActivationFeedAdaptersPanel } from '@/components/governance/GovernanceActivationFeedAdaptersPanel';

interface GovernanceActivationReviewCardProps {
  reviews: ActivationThresholdReviewRow[];
  demographicSnapshots: ActivationDemographicSnapshotRow[];
  latestEvidenceByReviewId: Record<string, ActivationEvidenceRow>;
  latestDecisionByReviewId: Record<string, ActivationDecisionRow>;
  loading: boolean;
  backendUnavailable: boolean;
  refreshingAllDemographics: boolean;
  refreshingScopeKey: string | null;
  savingDemographicSnapshot: boolean;
  recordingDecisionReviewId: string | null;
  formatTimestamp: (value: string | null) => string;
  onRefreshAllDemographics: () => void;
  onRefreshScopeDemographics: (scopeType: ActivationScopeType, countryCode: string) => void;
  onSaveDemographicSnapshot: (draft: ActivationDemographicSnapshotDraft) => void;
  onRecordDecision: (args: { reviewId: string; decision: ActivationReviewDecision; notes: string }) => void;
}

function getLocalDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function GovernanceActivationReviewCard({
  reviews,
  demographicSnapshots,
  latestEvidenceByReviewId,
  latestDecisionByReviewId,
  loading,
  backendUnavailable,
  refreshingAllDemographics,
  refreshingScopeKey,
  savingDemographicSnapshot,
  recordingDecisionReviewId,
  formatTimestamp,
  onRefreshAllDemographics,
  onRefreshScopeDemographics,
  onSaveDemographicSnapshot,
  onRecordDecision,
}: GovernanceActivationReviewCardProps) {
  const [snapshotDraft, setSnapshotDraft] = useState<ActivationDemographicSnapshotDraft>({
    scopeType: 'world',
    countryCode: '',
    jurisdictionLabel: 'World',
    targetPopulation: 1,
    sourceLabel: 'Steward estimate',
    sourceUrl: '',
    observedAt: getLocalDateTimeInputValue(),
    notes: '',
  });

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((left, right) => {
      if (left.scope_type !== right.scope_type) return left.scope_type === 'world' ? -1 : 1;
      if (left.country_code !== right.country_code) return left.country_code.localeCompare(right.country_code);
      return right.updated_at.localeCompare(left.updated_at);
    });
  }, [reviews]);

  const latestSnapshotByScopeKey = useMemo(() => {
    return demographicSnapshots.reduce<Record<string, ActivationDemographicSnapshotRow>>((accumulator, snapshot) => {
      const scopeKey = toActivationScopeKey(snapshot.scope_type, snapshot.country_code);
      if (!accumulator[scopeKey]) {
        accumulator[scopeKey] = snapshot;
      }
      return accumulator;
    }, {});
  }, [demographicSnapshots]);

  const handleSnapshotSubmit = () => {
    if (!snapshotDraft.sourceLabel.trim()) return;
    if (snapshotDraft.targetPopulation <= 0) return;
    if (snapshotDraft.scopeType === 'country' && !snapshotDraft.countryCode.trim()) return;

    onSaveDemographicSnapshot({
      ...snapshotDraft,
      countryCode: snapshotDraft.scopeType === 'world' ? '' : snapshotDraft.countryCode.trim().toUpperCase(),
      jurisdictionLabel: snapshotDraft.jurisdictionLabel.trim(),
      sourceLabel: snapshotDraft.sourceLabel.trim(),
      sourceUrl: snapshotDraft.sourceUrl.trim(),
      notes: snapshotDraft.notes.trim(),
    });
  };

  return (
    <Card id="stewardship-activation-review" className="scroll-mt-24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Activation Stewardship</h2>
          <p className="text-sm text-muted-foreground">
            Review activation thresholds, ingest demographic snapshots, and record activation decisions.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onRefreshAllDemographics}
          disabled={backendUnavailable || loading || refreshingAllDemographics}
        >
          {refreshingAllDemographics ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh all demographics
        </Button>
      </div>

      {backendUnavailable ? (
        <p className="mt-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Activation review tables are not available in this environment yet.
        </p>
      ) : loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activation review data...
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ingest demographic snapshot</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Scope type</Label>
                <Select
                  value={snapshotDraft.scopeType}
                  onValueChange={(value) => {
                    const scopeType = value as ActivationScopeType;
                    setSnapshotDraft((current) => ({
                      ...current,
                      scopeType,
                      countryCode: scopeType === 'world' ? '' : current.countryCode,
                      jurisdictionLabel: scopeType === 'world' ? 'World' : current.jurisdictionLabel,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="world">World</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {snapshotDraft.scopeType === 'country' ? (
                <div className="space-y-2">
                  <Label>Country code</Label>
                  <Input
                    value={snapshotDraft.countryCode}
                    maxLength={2}
                    onChange={(event) =>
                      setSnapshotDraft((current) => ({
                        ...current,
                        countryCode: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="US"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Jurisdiction label</Label>
                <Input
                  value={snapshotDraft.jurisdictionLabel}
                  onChange={(event) => setSnapshotDraft((current) => ({ ...current, jurisdictionLabel: event.target.value }))}
                  placeholder="World"
                />
              </div>

              <div className="space-y-2">
                <Label>Target population</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={snapshotDraft.targetPopulation}
                  onChange={(event) =>
                    setSnapshotDraft((current) => ({
                      ...current,
                      targetPopulation: Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Source label</Label>
                <Input
                  value={snapshotDraft.sourceLabel}
                  onChange={(event) => setSnapshotDraft((current) => ({ ...current, sourceLabel: event.target.value }))}
                  placeholder="UN demographic estimate"
                />
              </div>

              <div className="space-y-2">
                <Label>Observed at</Label>
                <Input
                  type="datetime-local"
                  value={snapshotDraft.observedAt}
                  onChange={(event) => setSnapshotDraft((current) => ({ ...current, observedAt: event.target.value }))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Source URL</Label>
                <Input
                  value={snapshotDraft.sourceUrl}
                  onChange={(event) => setSnapshotDraft((current) => ({ ...current, sourceUrl: event.target.value }))}
                  placeholder="https://example.com/demographic-source"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={snapshotDraft.notes}
                  onChange={(event) => setSnapshotDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Include review notes or source caveats."
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="button" variant="outline" className="gap-2" onClick={handleSnapshotSubmit} disabled={savingDemographicSnapshot}>
                {savingDemographicSnapshot ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ingest snapshot
              </Button>
            </div>
          </div>

          <GovernanceActivationFeedAdaptersPanel formatTimestamp={formatTimestamp} />

          {sortedReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activation reviews found yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedReviews.map((review) => {
                const scopeKey = toActivationScopeKey(review.scope_type, review.country_code);

                return (
                  <GovernanceActivationReviewScopeCard
                    key={review.id}
                    review={review}
                    latestSnapshot={latestSnapshotByScopeKey[scopeKey]}
                    latestEvidence={latestEvidenceByReviewId[review.id]}
                    latestDecision={latestDecisionByReviewId[review.id]}
                    refreshingScope={refreshingScopeKey === scopeKey}
                    recordingDecision={recordingDecisionReviewId === review.id}
                    refreshingAllDemographics={refreshingAllDemographics}
                    formatTimestamp={formatTimestamp}
                    onRefreshScope={(targetReview) => onRefreshScopeDemographics(targetReview.scope_type, targetReview.country_code)}
                    onRecordDecision={onRecordDecision}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
