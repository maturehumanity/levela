import { ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/integrations/supabase/types';
import type { GovernanceProposalDraft } from '@/lib/governance-proposal-draft';
import type { GovernanceDecisionClass } from '@/lib/governance-proposals';

import { GovernanceExecutionFields } from './GovernanceExecutionFields';

type ContentItemRow = Pick<
  Database['public']['Tables']['content_items']['Row'],
  'id' | 'title' | 'review_status' | 'content_type' | 'professional_domain' | 'source_table'
>;

type MonetaryPolicyProfileRow = Pick<
  Database['public']['Tables']['monetary_policy_profiles']['Row'],
  'id' | 'policy_name' | 'version' | 'is_active'
>;

type ProfileDirectoryRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'username' | 'role' | 'is_verified' | 'is_active_citizen'
>;

type GovernanceProposalComposerProps = {
  draft: GovernanceProposalDraft;
  executionUnits: Array<{ id: string; unit_key: string; name: string }>;
  profileDirectory: ProfileDirectoryRow[];
  monetaryPolicyProfiles: MonetaryPolicyProfileRow[];
  contentItems: ContentItemRow[];
  studyCertificationOptions: Array<{ key: string; label: string }>;
  creatingProposal: boolean;
  governanceEligible: boolean;
  backendUnavailable: boolean;
  formatContentItemLabel: (item: ContentItemRow) => string;
  formatProfileLabel: (entry: ProfileDirectoryRow) => string;
  onCreate: () => void;
  onDraftChange: (nextDraft: GovernanceProposalDraft) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function GovernanceProposalComposer({
  draft,
  executionUnits,
  profileDirectory,
  monetaryPolicyProfiles,
  contentItems,
  studyCertificationOptions,
  creatingProposal,
  governanceEligible,
  backendUnavailable,
  formatContentItemLabel,
  formatProfileLabel,
  onCreate,
  onDraftChange,
  t,
}: GovernanceProposalComposerProps) {
  const updateDraft = (nextFields: Partial<GovernanceProposalDraft>) => {
    onDraftChange({
      ...draft,
      ...nextFields,
    });
  };

  return (
    <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.createTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('governanceHub.createDescription')}</p>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="proposal-title">{t('governanceHub.fields.title')}</Label>
          <Input
            id="proposal-title"
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            placeholder={t('governanceHub.placeholders.title')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposal-summary">{t('governanceHub.fields.summary')}</Label>
          <Textarea
            id="proposal-summary"
            value={draft.summary}
            onChange={(event) => updateDraft({ summary: event.target.value })}
            placeholder={t('governanceHub.placeholders.summary')}
            className="min-h-[90px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proposal-body">{t('governanceHub.fields.body')}</Label>
          <Textarea
            id="proposal-body"
            value={draft.body}
            onChange={(event) => updateDraft({ body: event.target.value })}
            placeholder={t('governanceHub.placeholders.body')}
            className="min-h-[140px]"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('governanceHub.fields.decisionClass')}</Label>
          <Select
            value={draft.decisionClass}
            onValueChange={(value) => updateDraft({ decisionClass: value as GovernanceDecisionClass })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ordinary">{t('governanceHub.decisionClasses.ordinary')}</SelectItem>
              <SelectItem value="elevated">{t('governanceHub.decisionClasses.elevated')}</SelectItem>
              <SelectItem value="constitutional">{t('governanceHub.decisionClasses.constitutional')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <GovernanceExecutionFields
          draft={draft.execution}
          executionUnits={executionUnits}
          profileDirectory={profileDirectory}
          monetaryPolicyProfiles={monetaryPolicyProfiles}
          contentItems={contentItems}
          studyCertificationOptions={studyCertificationOptions}
          formatContentItemLabel={formatContentItemLabel}
          formatProfileLabel={formatProfileLabel}
          onChange={(execution) => updateDraft({ execution })}
          t={t}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={onCreate} disabled={creatingProposal || !governanceEligible || backendUnavailable} className="gap-2">
          {creatingProposal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {t('governanceHub.createAction')}
        </Button>
      </div>
    </Card>
  );
}
