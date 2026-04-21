import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';

import type { GovernanceExecutionApplyResult, GovernanceProposalExecutionSpec } from './types';

export async function applyMonetaryPolicyExecution(args: {
  client: SupabaseClient<Database>;
  actorId: string | null;
  spec: Extract<GovernanceProposalExecutionSpec, { actionType: 'activate_monetary_policy' | 'deactivate_monetary_policy' }>;
}) {
  const { data: targetPolicy, error: targetPolicyError } = await args.client
    .from('monetary_policy_profiles')
    .select('*')
    .eq('id', args.spec.policyProfileId)
    .maybeSingle();

  if (targetPolicyError || !targetPolicy) {
    return {
      status: 'blocked',
      summary: 'Could not load the target monetary policy profile.',
      details: { action_type: args.spec.actionType, error: targetPolicyError?.message || 'missing_policy', policy_profile_id: args.spec.policyProfileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  if (args.spec.actionType === 'activate_monetary_policy') {
    const { error: deactivateError } = await args.client
      .from('monetary_policy_profiles')
      .update({ is_active: false })
      .eq('is_active', true)
      .neq('id', targetPolicy.id);

    if (deactivateError) {
      return {
        status: 'blocked',
        summary: 'Could not deactivate the existing active monetary policies.',
        details: { action_type: args.spec.actionType, error: deactivateError.message, policy_profile_id: args.spec.policyProfileId },
      } satisfies GovernanceExecutionApplyResult;
    }
  }

  const { error: policyUpdateError } = await args.client
    .from('monetary_policy_profiles')
    .update({ is_active: args.spec.actionType === 'activate_monetary_policy' })
    .eq('id', targetPolicy.id);

  if (policyUpdateError) {
    return {
      status: 'blocked',
      summary: 'Could not update the monetary policy activation state.',
      details: { action_type: args.spec.actionType, error: policyUpdateError.message, policy_profile_id: args.spec.policyProfileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  const { error: auditError } = await args.client.from('monetary_policy_audit_events').insert({
    policy_profile_id: targetPolicy.id,
    actor_id: args.actorId,
    event_type: args.spec.actionType === 'activate_monetary_policy' ? 'governance_policy_activated' : 'governance_policy_deactivated',
    payload: {
      policy_name: targetPolicy.policy_name,
      version: targetPolicy.version,
      notes: args.spec.notes || null,
    },
  });

  if (auditError) {
    return {
      status: 'blocked',
      summary: 'Could not record the monetary policy audit event.',
      details: { action_type: args.spec.actionType, error: auditError.message, policy_profile_id: args.spec.policyProfileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  return {
    status: 'completed',
    summary: args.spec.actionType === 'activate_monetary_policy'
      ? `Activated monetary policy ${targetPolicy.policy_name} (${targetPolicy.version}).`
      : `Deactivated monetary policy ${targetPolicy.policy_name} (${targetPolicy.version}).`,
    details: { action_type: args.spec.actionType, policy_profile_id: args.spec.policyProfileId, policy_name: targetPolicy.policy_name, version: targetPolicy.version },
  } satisfies GovernanceExecutionApplyResult;
}

export async function applyStudyCertificationExecution(args: {
  client: SupabaseClient<Database>;
  spec: Extract<GovernanceProposalExecutionSpec, { actionType: 'award_study_certification' | 'revoke_study_certification' }>;
}) {
  const nextStatus = args.spec.actionType === 'award_study_certification' ? 'earned' : 'pending';
  const nextEarnedAt = args.spec.actionType === 'award_study_certification' ? new Date().toISOString() : null;

  const { error } = await args.client.from('study_certifications').upsert(
    {
      profile_id: args.spec.profileId,
      certification_key: args.spec.certificationKey,
      status: nextStatus,
      earned_at: nextEarnedAt,
      metadata: {
        governance_notes: args.spec.notes || null,
        governance_action: args.spec.actionType,
      },
    },
    { onConflict: 'profile_id,certification_key' },
  );

  if (error) {
    return {
      status: 'blocked',
      summary: 'Could not update the study certification record.',
      details: {
        action_type: args.spec.actionType,
        error: error.message,
        profile_id: args.spec.profileId,
        certification_key: args.spec.certificationKey,
      },
    } satisfies GovernanceExecutionApplyResult;
  }

  return {
    status: 'completed',
    summary: args.spec.actionType === 'award_study_certification'
      ? `Awarded ${args.spec.certificationKey} certification to profile ${args.spec.profileId}.`
      : `Revoked ${args.spec.certificationKey} certification from profile ${args.spec.profileId}.`,
    details: {
      action_type: args.spec.actionType,
      profile_id: args.spec.profileId,
      certification_key: args.spec.certificationKey,
      status: nextStatus,
    },
  } satisfies GovernanceExecutionApplyResult;
}

export async function applyContentReviewExecution(args: {
  client: SupabaseClient<Database>;
  actorId: string | null;
  spec: Extract<GovernanceProposalExecutionSpec, { actionType: 'approve_content_item' | 'reject_content_item' | 'archive_content_item' }>;
}) {
  const { error } = await args.client
    .from('content_items')
    .update({
      review_status: args.spec.reviewStatus,
      reviewer_id: args.actorId,
      reviewed_at: new Date().toISOString(),
      metadata: {
        governance_notes: args.spec.notes || null,
        governance_action: args.spec.actionType,
      },
    })
    .eq('id', args.spec.contentItemId);

  if (error) {
    return {
      status: 'blocked',
      summary: 'Could not update the content review state.',
      details: {
        action_type: args.spec.actionType,
        error: error.message,
        content_item_id: args.spec.contentItemId,
        review_status: args.spec.reviewStatus,
      },
    } satisfies GovernanceExecutionApplyResult;
  }

  return {
    status: 'completed',
    summary: `${args.spec.reviewStatus} content item ${args.spec.contentItemId}.`,
    details: {
      action_type: args.spec.actionType,
      content_item_id: args.spec.contentItemId,
      review_status: args.spec.reviewStatus,
    },
  } satisfies GovernanceExecutionApplyResult;
}
