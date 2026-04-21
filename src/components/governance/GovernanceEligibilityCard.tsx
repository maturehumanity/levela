import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type GovernanceEligibilityCardProps = {
  governanceEligibility: {
    eligible: boolean;
    influenceWeight: number;
  };
  governanceEndorsementCount: number;
  governanceRequirementMessages: string[];
  governanceScore: number | null;
  isNativeMobileGovernanceDevice: boolean;
  loadingGovernanceEligibility: boolean;
  profileIsVerified?: boolean | null;
  t: (key: string) => string;
  governanceEligibilityUnavailable: boolean;
  minGovernanceScore: number;
};

export function GovernanceEligibilityCard({
  governanceEligibility,
  governanceEndorsementCount,
  governanceRequirementMessages,
  governanceScore,
  isNativeMobileGovernanceDevice,
  loadingGovernanceEligibility,
  profileIsVerified,
  t,
  governanceEligibilityUnavailable,
  minGovernanceScore,
}: GovernanceEligibilityCardProps) {
  return (
    <Card className="mb-3 border-border/70 bg-card/95 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('governance.eligibilityTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('governance.eligibilityDescription')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={governanceEligibility.eligible ? 'secondary' : 'outline'}>
              {governanceEligibility.eligible ? t('governance.eligibilityStatusEligible') : t('governance.eligibilityStatusIneligible')}
            </Badge>
            <Badge variant={governanceEligibility.influenceWeight === 1 ? 'secondary' : 'outline'}>
              {t('governance.influenceWeightLabel')}: {governanceEligibility.influenceWeight}
            </Badge>
            <Badge variant={isNativeMobileGovernanceDevice ? 'secondary' : 'outline'}>
              {t('governance.deviceLabel')}: {isNativeMobileGovernanceDevice ? t('governance.deviceNative') : t('governance.deviceWeb')}
            </Badge>
            <Badge variant={profileIsVerified ? 'secondary' : 'outline'}>
              {t('governance.verificationLabel')}: {profileIsVerified ? t('governance.verificationVerified') : t('governance.verificationUnverified')}
            </Badge>
          </div>

          <div className="grid gap-3 text-sm text-foreground sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('governance.scoreLabel')}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{loadingGovernanceEligibility ? '...' : governanceScore?.toFixed(1) ?? '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{governanceEndorsementCount} endorsement{governanceEndorsementCount === 1 ? '' : 's'}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('governance.minimumScoreLabel')}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{minGovernanceScore.toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('governance.influenceWeightLabel')}</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{governanceEligibility.influenceWeight}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('governance.zeroInfluenceRule')}</p>

          {loadingGovernanceEligibility ? (
            <p className="text-xs text-muted-foreground">{t('governance.eligibilityLoading')}</p>
          ) : governanceEligibilityUnavailable ? (
            <p className="text-xs text-muted-foreground">{t('governance.eligibilityUnavailable')}</p>
          ) : governanceRequirementMessages.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('governance.requirementsHeading')}</p>
              <ul className="space-y-1 text-sm text-foreground">
                {governanceRequirementMessages.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
