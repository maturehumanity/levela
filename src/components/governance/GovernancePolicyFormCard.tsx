import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type GovernancePolicyState = {
  activeCitizens: number;
  civicLiquidityBaseline: number;
  approvedPublicBudget: number;
  outputLiquidityRatio: number;
  inflationTarget: number;
  stabilityDampeningMultiplier: number;
  autoApprovalLimit: number;
  maxInflationRisk: number;
  affordabilityAlertThreshold: number;
};

type GovernancePolicyFormCardProps = {
  form: GovernancePolicyState;
  loadingRemoteState: boolean;
  savedAt: string | null;
  savingPolicy: boolean;
  t: (key: string) => string;
  isBlocked: boolean;
  onSave: () => void;
  onUpdateField: (field: keyof GovernancePolicyState, value: string) => void;
};

export function GovernancePolicyFormCard({
  form,
  isBlocked,
  loadingRemoteState,
  onSave,
  onUpdateField,
  savedAt,
  savingPolicy,
  t,
}: GovernancePolicyFormCardProps) {
  const fields: Array<{ key: keyof GovernancePolicyState; step?: string; colSpan?: string }> = [
    { key: 'activeCitizens' },
    { key: 'civicLiquidityBaseline', step: '0.01' },
    { key: 'outputLiquidityRatio', step: '0.001' },
    { key: 'approvedPublicBudget', step: '0.01' },
    { key: 'inflationTarget', step: '0.001' },
    { key: 'stabilityDampeningMultiplier', step: '1' },
    { key: 'autoApprovalLimit', step: '0.01' },
    { key: 'maxInflationRisk', step: '0.001' },
    { key: 'affordabilityAlertThreshold', step: '0.001', colSpan: 'md:col-span-2' },
  ];

  return (
    <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{t('governance.policyControlsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('governance.policyControlsDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{t('governance.saved')}</span>}
          <Button onClick={onSave} className="gap-2" disabled={savingPolicy || loadingRemoteState || isBlocked}>
            {savingPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('governance.savePolicy')}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={`space-y-2 ${field.colSpan || ''}`.trim()}>
            <Label htmlFor={field.key}>{t(`governance.fields.${field.key}`)}</Label>
            <Input
              id={field.key}
              type="number"
              step={field.step}
              value={form[field.key]}
              onChange={(event) => onUpdateField(field.key, event.target.value)}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
