import type { Database } from '@/integrations/supabase/types';
import type { GovernanceExecutionDraft } from '@/lib/governance-execution';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type ContentItemRow = Pick<
  Database['public']['Tables']['content_items']['Row'],
  'id' | 'title' | 'review_status' | 'content_type' | 'professional_domain' | 'source_table'
>;

type ProfileDirectoryRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'username' | 'role' | 'is_verified' | 'is_active_citizen'
>;

type GovernanceExecutionStudyContentFieldsProps = {
  draft: GovernanceExecutionDraft;
  profileDirectory: ProfileDirectoryRow[];
  contentItems: ContentItemRow[];
  studyCertificationOptions: Array<{ key: string; label: string }>;
  formatContentItemLabel: (item: ContentItemRow) => string;
  formatProfileLabel: (entry: ProfileDirectoryRow) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onChange: (nextDraft: GovernanceExecutionDraft) => void;
};

function NotesField(args: {
  draft: GovernanceExecutionDraft;
  id: string;
  onChange: (nextDraft: GovernanceExecutionDraft) => void;
  t: GovernanceExecutionStudyContentFieldsProps['t'];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={args.id}>{args.t('governanceHub.fields.executionNotes')}</Label>
      <Textarea
        id={args.id}
        value={args.draft.notes}
        onChange={(event) =>
          args.onChange({
            ...args.draft,
            notes: event.target.value,
          })
        }
        placeholder={args.t('governanceHub.placeholders.executionNotes')}
        className="min-h-[80px]"
      />
    </div>
  );
}

export function GovernanceExecutionStudyContentFields({
  draft,
  profileDirectory,
  contentItems,
  studyCertificationOptions,
  formatContentItemLabel,
  formatProfileLabel,
  t,
  onChange,
}: GovernanceExecutionStudyContentFieldsProps) {
  if (draft.actionType === 'award_study_certification' || draft.actionType === 'revoke_study_certification') {
    return (
      <>
        <div className="space-y-2">
          <Label>{t('governanceHub.fields.targetProfile')}</Label>
          <Select value={draft.targetProfileId || undefined} onValueChange={(value) => onChange({ ...draft, targetProfileId: value })}>
            <SelectTrigger>
              <SelectValue placeholder={t('governanceHub.fields.targetProfile')} />
            </SelectTrigger>
            <SelectContent>
              {profileDirectory.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {formatProfileLabel(entry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('governanceHub.fields.targetCertification')}</Label>
          <Select
            value={draft.studyCertificationKey || undefined}
            onValueChange={(value) => onChange({ ...draft, studyCertificationKey: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('governanceHub.fields.targetCertification')} />
            </SelectTrigger>
            <SelectContent>
              {studyCertificationOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NotesField draft={draft} id="proposal-certification-notes" onChange={onChange} t={t} />
      </>
    );
  }

  if (draft.actionType === 'approve_content_item'
    || draft.actionType === 'reject_content_item'
    || draft.actionType === 'archive_content_item') {
    return (
      <>
        <div className="space-y-2">
          <Label>{t('governanceHub.fields.targetContentItem')}</Label>
          <Select value={draft.contentItemId || undefined} onValueChange={(value) => onChange({ ...draft, contentItemId: value })}>
            <SelectTrigger>
              <SelectValue placeholder={t('governanceHub.fields.targetContentItem')} />
            </SelectTrigger>
            <SelectContent>
              {contentItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {formatContentItemLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NotesField draft={draft} id="proposal-content-notes" onChange={onChange} t={t} />
      </>
    );
  }

  return null;
}
