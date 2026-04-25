import { motion } from 'framer-motion';
import { Globe2, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  calculateActivationCoveragePercent,
  getActivationReviewStatusBadgeClassName,
  getActivationReviewStatusLabelKey,
  readLatestActivationIngestionTimestamp,
  type ActivationThresholdReviewHubRow,
} from '@/lib/governance-activation-review';

export type GovernanceHubActivationReadinessCardProps = {
  motionDelaySec: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDateTime: (value: string | null) => string;
  citizenActivationReviews: ActivationThresholdReviewHubRow[];
  activationHubLoading: boolean;
  activationHubUnavailable: boolean;
  activationHubLoadFailed: boolean;
};

export function GovernanceHubActivationReadinessCard({
  motionDelaySec,
  t,
  formatDateTime,
  citizenActivationReviews,
  activationHubLoading,
  activationHubUnavailable,
  activationHubLoadFailed,
}: GovernanceHubActivationReadinessCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionDelaySec }}>
      <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Globe2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.activationReview.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('governanceHub.activationReview.subtitle')}</p>
              </div>

              {activationHubLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>{t('common.loading')}</span>
                </div>
              ) : null}

              {activationHubUnavailable ? (
                <p className="text-sm text-muted-foreground">{t('governanceHub.activationReview.backendUnavailable')}</p>
              ) : null}

              {activationHubLoadFailed ? (
                <p className="text-sm text-muted-foreground">{t('governanceHub.activationReview.loadFailed')}</p>
              ) : null}

              {!activationHubLoading && !activationHubUnavailable && !activationHubLoadFailed && citizenActivationReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('governanceHub.activationReview.empty')}</p>
              ) : null}

              {!activationHubLoading && !activationHubUnavailable && !activationHubLoadFailed && citizenActivationReviews.length > 0 ? (
                <div className="space-y-4">
                  {citizenActivationReviews.map((review) => {
                    const coveragePercent = calculateActivationCoveragePercent(review);
                    const lastIngest = readLatestActivationIngestionTimestamp(review.metadata);

                    return (
                      <div key={review.id} className="space-y-2 rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-base font-semibold text-foreground">{review.jurisdiction_label}</h3>
                          <Badge variant="outline" className={`rounded-full ${getActivationReviewStatusBadgeClassName(review.status)}`}>
                            {t(getActivationReviewStatusLabelKey(review.status))}
                          </Badge>
                        </div>
                        {coveragePercent != null ? (
                          <p className="text-sm text-muted-foreground">
                            {t('governanceHub.activationReview.coverageLabel', { percent: coveragePercent })}
                          </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          {t('governanceHub.activationReview.thresholdLabel', { percent: review.threshold_percent })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {review.target_population && review.target_population > 0
                            ? t('governanceHub.activationReview.countsLabel', {
                                eligible: review.eligible_verified_citizens_count,
                                target: review.target_population,
                              })
                            : t('governanceHub.activationReview.countsLabelNoTarget', {
                                eligible: review.eligible_verified_citizens_count,
                              })}
                        </p>
                        {lastIngest ? (
                          <p className="text-xs text-muted-foreground">
                            {t('governanceHub.activationReview.lastDemographicIngest', { at: formatDateTime(lastIngest) })}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">{t('governanceHub.activationReview.stewardshipNote')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
