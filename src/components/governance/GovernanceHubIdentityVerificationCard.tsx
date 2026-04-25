import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, UserCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  getVerificationCaseBadgeClassName,
  getVerificationCaseStatusLabelKey,
  type GovernanceHubIdentityVerificationPresentation,
} from '@/lib/verification-workflow';

export type GovernanceHubIdentityVerificationCardProps = {
  motionDelaySec: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  identityVerificationPresentation: GovernanceHubIdentityVerificationPresentation | null;
  identityVerificationLoading: boolean;
  identityVerificationUnavailable: boolean;
  identityVerificationLoadFailed: boolean;
};

export function GovernanceHubIdentityVerificationCard({
  motionDelaySec,
  t,
  identityVerificationPresentation,
  identityVerificationLoading,
  identityVerificationUnavailable,
  identityVerificationLoadFailed,
}: GovernanceHubIdentityVerificationCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionDelaySec }}>
      <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.identityVerification.title')}</h2>
                {identityVerificationPresentation ? (
                  <Badge variant="outline" className={`rounded-full ${getVerificationCaseBadgeClassName(identityVerificationPresentation.badgeStatus)}`}>
                    {t(
                      identityVerificationPresentation.badgeLabelKey
                        ?? getVerificationCaseStatusLabelKey(identityVerificationPresentation.badgeStatus),
                    )}
                  </Badge>
                ) : null}
              </div>

              {identityVerificationLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>{t('common.loading')}</span>
                </div>
              ) : null}

              {identityVerificationUnavailable ? (
                <p className="text-sm text-muted-foreground">{t('governanceHub.identityVerification.backendUnavailable')}</p>
              ) : null}

              {identityVerificationLoadFailed ? (
                <p className="text-sm text-muted-foreground">{t('governanceHub.identityVerification.loadFailed')}</p>
              ) : null}

              {identityVerificationLoadFailed || identityVerificationUnavailable ? (
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link to="/settings/profile">{t('governanceHub.identityVerification.ctaReviewProfile')}</Link>
                </Button>
              ) : null}

              {identityVerificationPresentation ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t(identityVerificationPresentation.bodyKey)}</p>
                  {identityVerificationPresentation.checklistKeys.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {identityVerificationPresentation.checklistKeys.map((key) => (
                        <li key={key}>{t(key)}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link to="/settings/profile">{t(identityVerificationPresentation.ctaLabelKey)}</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
