import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type ApprovalClass = 'ordinary' | 'elevated' | 'emergency';
type ApprovalDecision = 'approved' | 'rejected';

type GovernanceApprovalCardProps = {
  activePolicyId: string | null;
  approvalClass: ApprovalClass;
  approvalDecision: ApprovalDecision;
  approvalNotes: string;
  approvalSummary: Record<ApprovalClass, number>;
  isBlocked: boolean;
  loadingRemoteState: boolean;
  recordingApproval: boolean;
  t: (key: string) => string;
  onRecordApproval: () => void;
  onSetApprovalClass: (value: ApprovalClass) => void;
  onSetApprovalDecision: (value: ApprovalDecision) => void;
  onSetApprovalNotes: (value: string) => void;
};

export function GovernanceApprovalCard({
  activePolicyId,
  approvalClass,
  approvalDecision,
  approvalNotes,
  approvalSummary,
  isBlocked,
  loadingRemoteState,
  recordingApproval,
  t,
  onRecordApproval,
  onSetApprovalClass,
  onSetApprovalDecision,
  onSetApprovalNotes,
}: GovernanceApprovalCardProps) {
  return (
    <Card className="border-border/70 bg-card/95 p-4 shadow-sm">
      <h3 className="font-semibold text-foreground">{t('governance.approvalsTitle')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('governance.approvalsDescription')}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Badge variant="outline" className="justify-center py-1">{t('governance.approvalClass.ordinary')}: {approvalSummary.ordinary}</Badge>
        <Badge variant="outline" className="justify-center py-1">{t('governance.approvalClass.elevated')}: {approvalSummary.elevated}</Badge>
        <Badge variant="outline" className="justify-center py-1">{t('governance.approvalClass.emergency')}: {approvalSummary.emergency}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('governance.approvalClassLabel')}</Label>
            <Select value={approvalClass} onValueChange={(value) => onSetApprovalClass(value as ApprovalClass)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ordinary">{t('governance.approvalClass.ordinary')}</SelectItem>
                <SelectItem value="elevated">{t('governance.approvalClass.elevated')}</SelectItem>
                <SelectItem value="emergency">{t('governance.approvalClass.emergency')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('governance.approvalDecisionLabel')}</Label>
            <Select value={approvalDecision} onValueChange={(value) => onSetApprovalDecision(value as ApprovalDecision)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">{t('governance.approvalDecision.approved')}</SelectItem>
                <SelectItem value="rejected">{t('governance.approvalDecision.rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('governance.approvalNotesLabel')}</Label>
          <Textarea value={approvalNotes} onChange={(event) => onSetApprovalNotes(event.target.value)} placeholder={t('governance.approvalNotesPlaceholder')} />
        </div>
        <Button onClick={onRecordApproval} disabled={!activePolicyId || recordingApproval || loadingRemoteState || isBlocked} className="gap-2">
          {recordingApproval && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('governance.recordApproval')}
        </Button>
      </div>
    </Card>
  );
}
