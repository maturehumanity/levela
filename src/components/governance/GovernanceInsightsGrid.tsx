import { Settings2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type GovernanceInsightsGridProps = {
  policySignals: {
    status: 'stable' | 'watch' | 'alert';
    alerts: Array<{ code: string; message: string }>;
  };
  projectedQuarterlyCeiling: number;
  t: (key: string) => string;
};

export function GovernanceInsightsGrid({
  policySignals,
  projectedQuarterlyCeiling,
  t,
}: GovernanceInsightsGridProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">{t('governance.simulationTitle')}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('governance.simulationDescription')}</p>
        <div className="mt-4 rounded-2xl border border-border/60 bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{t('governance.simulationQuarterlyCeiling')}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{projectedQuarterlyCeiling.toLocaleString()}</p>
        </div>
      </Card>

      <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">{t('governance.guardrailStatusTitle')}</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('governance.guardrailStatusDescription')}</p>
        <div className="mt-3">
          <Badge variant={policySignals.status === 'stable' ? 'secondary' : 'outline'} className="rounded-full">
            {t(`governance.status.${policySignals.status}`)}
          </Badge>
          <ul className="mt-3 space-y-2 text-sm text-foreground/90">
            {policySignals.alerts.length === 0 ? <li>{t('governance.noAlerts')}</li> : policySignals.alerts.map((alert) => <li key={alert.code}>{alert.message}</li>)}
          </ul>
        </div>
      </Card>
    </div>
  );
}
