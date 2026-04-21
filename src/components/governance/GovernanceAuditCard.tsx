import { Card } from '@/components/ui/card';

type AuditRow = {
  id: string;
  event_type: string;
  created_at: string;
};

type GovernanceAuditCardProps = {
  auditRows: AuditRow[];
  formatTimestamp: (value: string) => string;
  t: (key: string) => string;
};

export function GovernanceAuditCard({
  auditRows,
  formatTimestamp,
  t,
}: GovernanceAuditCardProps) {
  return (
    <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
      <h3 className="font-semibold text-foreground">{t('governance.auditLogTitle')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('governance.auditLogDescription')}</p>
      {auditRows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('governance.noAuditEvents')}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {auditRows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border/60 bg-background/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.event_type}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(row.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
