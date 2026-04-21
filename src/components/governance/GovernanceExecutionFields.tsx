import type { Database } from '@/integrations/supabase/types';
import { APP_PERMISSIONS, APP_ROLES } from '@/lib/access-control';
import {
  getGovernanceExecutionActionLabelKey,
  getGovernanceUnitMembershipRoleLabelKey,
  type GovernanceExecutionDraft,
} from '@/lib/governance-execution';
import { permissionMetadataMap } from '@/lib/permission-metadata';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { GovernanceExecutionStudyContentFields } from './GovernanceExecutionStudyContentFields';

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

type GovernanceExecutionFieldsProps = {
  draft: GovernanceExecutionDraft;
  executionUnits: Array<{ id: string; unit_key: string; name: string }>;
  profileDirectory: ProfileDirectoryRow[];
  monetaryPolicyProfiles: MonetaryPolicyProfileRow[];
  contentItems: ContentItemRow[];
  studyCertificationOptions: Array<{ key: string; label: string }>;
  formatContentItemLabel: (item: ContentItemRow) => string;
  formatProfileLabel: (entry: ProfileDirectoryRow) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onChange: (nextDraft: GovernanceExecutionDraft) => void;
};

const ACTION_OPTIONS: GovernanceExecutionDraft['actionType'][] = [
  'manual_follow_through',
  'grant_role_permission',
  'revoke_role_permission',
  'assign_unit_member',
  'deactivate_unit_member',
  'approve_identity_verification',
  'revoke_identity_verification',
  'activate_citizen_scope',
  'deactivate_citizen_scope',
  'activate_monetary_policy',
  'deactivate_monetary_policy',
  'award_study_certification',
  'revoke_study_certification',
  'approve_content_item',
  'reject_content_item',
  'archive_content_item',
];

function NotesField(args: {
  draft: GovernanceExecutionDraft;
  id: string;
  onChange: (nextDraft: GovernanceExecutionDraft) => void;
  placeholder: string;
  t: GovernanceExecutionFieldsProps['t'];
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
        placeholder={args.placeholder}
        className="min-h-[80px]"
      />
    </div>
  );
}

export function GovernanceExecutionFields({
  draft,
  executionUnits,
  profileDirectory,
  monetaryPolicyProfiles,
  contentItems,
  studyCertificationOptions,
  formatContentItemLabel,
  formatProfileLabel,
  t,
  onChange,
}: GovernanceExecutionFieldsProps) {
  const updateDraft = (nextExecutionFields: Partial<GovernanceExecutionDraft>) => {
    onChange({
      ...draft,
      ...nextExecutionFields,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('governanceHub.fields.executionAction')}</Label>
        <Select
          value={draft.actionType}
          onValueChange={(value) =>
            onChange({
              ...draft,
              actionType: value as GovernanceExecutionDraft['actionType'],
              targetRole: '',
              targetPermission: '',
              targetUnitKey: '',
              targetProfileId: '',
              membershipRole: 'member',
              activationScopeType: 'world',
              activationCountryCode: '',
              policyProfileId: '',
              studyCertificationKey: '',
              contentItemId: '',
              notes: '',
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((actionType) => (
              <SelectItem key={actionType} value={actionType}>
                {t(getGovernanceExecutionActionLabelKey(actionType))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(draft.actionType === 'grant_role_permission' || draft.actionType === 'revoke_role_permission') && (
        <>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetRole')}</Label>
            <Select
              value={draft.targetRole || undefined}
              onValueChange={(value) => updateDraft({ targetRole: value as GovernanceExecutionDraft['targetRole'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('governanceHub.fields.targetRole')} />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`admin.roles.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetPermission')}</Label>
            <Select
              value={draft.targetPermission || undefined}
              onValueChange={(value) =>
                updateDraft({ targetPermission: value as GovernanceExecutionDraft['targetPermission'] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('governanceHub.fields.targetPermission')} />
              </SelectTrigger>
              <SelectContent>
                {APP_PERMISSIONS.map((permission) => (
                  <SelectItem key={permission} value={permission}>
                    {t(permissionMetadataMap[permission].titleKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {(draft.actionType === 'assign_unit_member' || draft.actionType === 'deactivate_unit_member') && (
        <>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetUnit')}</Label>
            <Select value={draft.targetUnitKey || undefined} onValueChange={(value) => updateDraft({ targetUnitKey: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('governanceHub.fields.targetUnit')} />
              </SelectTrigger>
              <SelectContent>
                {executionUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.unit_key}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetProfile')}</Label>
            <Select value={draft.targetProfileId || undefined} onValueChange={(value) => updateDraft({ targetProfileId: value })}>
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
          {draft.actionType === 'assign_unit_member' && (
            <div className="space-y-2">
              <Label>{t('governanceHub.fields.membershipRole')}</Label>
              <Select
                value={draft.membershipRole}
                onValueChange={(value) =>
                  updateDraft({ membershipRole: value as GovernanceExecutionDraft['membershipRole'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">{t(getGovernanceUnitMembershipRoleLabelKey('lead'))}</SelectItem>
                  <SelectItem value="member">{t(getGovernanceUnitMembershipRoleLabelKey('member'))}</SelectItem>
                  <SelectItem value="observer">{t(getGovernanceUnitMembershipRoleLabelKey('observer'))}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <NotesField
            draft={draft}
            id="proposal-execution-notes"
            onChange={onChange}
            placeholder={t('governanceHub.placeholders.executionNotes')}
            t={t}
          />
        </>
      )}

      {(draft.actionType === 'approve_identity_verification' || draft.actionType === 'revoke_identity_verification') && (
        <>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetProfile')}</Label>
            <Select value={draft.targetProfileId || undefined} onValueChange={(value) => updateDraft({ targetProfileId: value })}>
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
          <NotesField
            draft={draft}
            id="proposal-verification-notes"
            onChange={onChange}
            placeholder={t('governanceHub.placeholders.executionNotes')}
            t={t}
          />
        </>
      )}

      {(draft.actionType === 'activate_citizen_scope' || draft.actionType === 'deactivate_citizen_scope') && (
        <>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetProfile')}</Label>
            <Select value={draft.targetProfileId || undefined} onValueChange={(value) => updateDraft({ targetProfileId: value })}>
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
            <Label>{t('governanceHub.fields.activationScope')}</Label>
            <Select
              value={draft.activationScopeType}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  activationScopeType: value as GovernanceExecutionDraft['activationScopeType'],
                  activationCountryCode: value === 'country' ? draft.activationCountryCode : '',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="world">{t('governanceHub.activationScopes.world')}</SelectItem>
                <SelectItem value="country">{t('governanceHub.activationScopes.country')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.activationScopeType === 'country' && (
            <div className="space-y-2">
              <Label htmlFor="proposal-country-code">{t('governanceHub.fields.countryCode')}</Label>
              <Input
                id="proposal-country-code"
                value={draft.activationCountryCode}
                onChange={(event) => updateDraft({ activationCountryCode: event.target.value.toUpperCase() })}
                placeholder={t('governanceHub.placeholders.countryCode')}
                maxLength={3}
              />
            </div>
          )}
          <NotesField
            draft={draft}
            id="proposal-activation-notes"
            onChange={onChange}
            placeholder={t('governanceHub.placeholders.executionNotes')}
            t={t}
          />
        </>
      )}

      {(draft.actionType === 'activate_monetary_policy' || draft.actionType === 'deactivate_monetary_policy') && (
        <>
          <div className="space-y-2">
            <Label>{t('governanceHub.fields.targetPolicy')}</Label>
            <Select value={draft.policyProfileId || undefined} onValueChange={(value) => updateDraft({ policyProfileId: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('governanceHub.fields.targetPolicy')} />
              </SelectTrigger>
              <SelectContent>
                {monetaryPolicyProfiles.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.policy_name} ({policy.version}){policy.is_active ? ` • ${t('governanceHub.policyActiveBadge')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NotesField
            draft={draft}
            id="proposal-policy-notes"
            onChange={onChange}
            placeholder={t('governanceHub.placeholders.executionNotes')}
            t={t}
          />
        </>
      )}

      <GovernanceExecutionStudyContentFields
        draft={draft}
        profileDirectory={profileDirectory}
        contentItems={contentItems}
        studyCertificationOptions={studyCertificationOptions}
        formatContentItemLabel={formatContentItemLabel}
        formatProfileLabel={formatProfileLabel}
        onChange={onChange}
        t={t}
      />
    </div>
  );
}
