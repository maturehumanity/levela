import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { isActivationScopeDeclared } from '@/lib/activation-review';

import type { GovernanceExecutionApplyResult, GovernanceProposalExecutionSpec } from './types';
import { normalizeCountryCode } from './types';

export async function applyVerificationExecution(args: {
  client: SupabaseClient<Database>;
  actorId: string | null;
  spec: Extract<GovernanceProposalExecutionSpec, { actionType: 'approve_identity_verification' | 'revoke_identity_verification' }>;
}) {
  const { data: verificationCase, error: caseLookupError } = await args.client
    .from('identity_verification_cases')
    .select('*')
    .eq('profile_id', args.spec.profileId)
    .maybeSingle();

  if (caseLookupError) {
    return {
      status: 'blocked',
      summary: 'Could not load the identity verification case.',
      details: { action_type: args.spec.actionType, error: caseLookupError.message, profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  if (!verificationCase) {
    return {
      status: 'blocked',
      summary: 'No identity verification case exists for the target profile.',
      details: { action_type: args.spec.actionType, profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  if (
    args.spec.actionType === 'approve_identity_verification'
    && (!verificationCase.personal_info_completed || !verificationCase.contact_info_completed || !verificationCase.live_verification_completed)
  ) {
    return {
      status: 'blocked',
      summary: 'The identity verification case is incomplete and cannot be approved yet.',
      details: {
        action_type: args.spec.actionType,
        profile_id: args.spec.profileId,
        personal_info_completed: verificationCase.personal_info_completed,
        contact_info_completed: verificationCase.contact_info_completed,
        live_verification_completed: verificationCase.live_verification_completed,
      },
    } satisfies GovernanceExecutionApplyResult;
  }

  const now = new Date().toISOString();
  const { error: caseUpdateError } = await args.client
    .from('identity_verification_cases')
    .update({
      status: args.spec.actionType === 'approve_identity_verification' ? 'in_review' : 'revoked',
      reviewed_at: now,
      last_reviewed_by: args.actorId,
      notes: args.spec.notes || verificationCase.notes,
    })
    .eq('id', verificationCase.id);

  if (caseUpdateError) {
    return {
      status: 'blocked',
      summary: 'Could not update the identity verification case.',
      details: { action_type: args.spec.actionType, error: caseUpdateError.message, profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  const { error: reviewError } = await args.client.from('identity_verification_reviews').insert({
    case_id: verificationCase.id,
    reviewer_id: args.actorId,
    decision: args.spec.actionType === 'approve_identity_verification' ? 'approved' : 'revoked',
    notes: args.spec.notes || 'Governance execution review',
  });

  if (reviewError) {
    return {
      status: 'blocked',
      summary: 'Could not record the identity verification review decision.',
      details: { action_type: args.spec.actionType, error: reviewError.message, profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  return {
    status: 'completed',
    summary: args.spec.actionType === 'approve_identity_verification'
      ? `Approved identity verification for profile ${args.spec.profileId}.`
      : `Revoked identity verification for profile ${args.spec.profileId}.`,
    details: { action_type: args.spec.actionType, profile_id: args.spec.profileId },
  } satisfies GovernanceExecutionApplyResult;
}

export async function applyActivationScopeExecution(args: {
  client: SupabaseClient<Database>;
  actorId: string | null;
  spec: Extract<GovernanceProposalExecutionSpec, { actionType: 'activate_citizen_scope' | 'deactivate_citizen_scope' }>;
}) {
  const normalizedCountryCode = normalizeCountryCode(args.spec.scopeType, args.spec.countryCode);
  const { data: targetProfile, error: profileLookupError } = await args.client
    .from('profiles')
    .select('id, citizenship_status')
    .eq('id', args.spec.profileId)
    .maybeSingle();

  if (profileLookupError || !targetProfile) {
    return {
      status: 'blocked',
      summary: 'Could not load the target citizen profile.',
      details: { action_type: args.spec.actionType, error: profileLookupError?.message || 'missing_profile', profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  if (args.spec.actionType === 'activate_citizen_scope' && targetProfile.citizenship_status !== 'citizen') {
    return {
      status: 'blocked',
      summary: 'Only citizens can be activated into an active civic scope.',
      details: { action_type: args.spec.actionType, profile_id: args.spec.profileId, citizenship_status: targetProfile.citizenship_status },
    } satisfies GovernanceExecutionApplyResult;
  }

  if (args.spec.actionType === 'activate_citizen_scope') {
    const { data: activationReview, error: activationReviewError } = await args.client
      .from('activation_threshold_reviews')
      .select('status, declared_at')
      .eq('scope_type', args.spec.scopeType)
      .eq('country_code', normalizedCountryCode)
      .maybeSingle();

    if (activationReviewError) {
      return {
        status: 'blocked',
        summary: 'Could not load activation declaration state for the requested scope.',
        details: {
          action_type: args.spec.actionType,
          error: activationReviewError.message,
          profile_id: args.spec.profileId,
          scope_type: args.spec.scopeType,
          country_code: normalizedCountryCode,
        },
      } satisfies GovernanceExecutionApplyResult;
    }

    if (!isActivationScopeDeclared(activationReview)) {
      return {
        status: 'blocked',
        summary: 'Activation has not been formally declared for the requested scope.',
        details: {
          action_type: args.spec.actionType,
          profile_id: args.spec.profileId,
          scope_type: args.spec.scopeType,
          country_code: normalizedCountryCode,
          activation_review_status: activationReview?.status ?? null,
          declared_at: activationReview?.declared_at ?? null,
        },
      } satisfies GovernanceExecutionApplyResult;
    }

    const { error: activationError } = await args.client.from('citizen_activation_scopes').upsert(
      {
        profile_id: args.spec.profileId,
        scope_type: args.spec.scopeType,
        country_code: normalizedCountryCode,
        activated_by: args.actorId,
        notes: args.spec.notes || 'Governance-approved activation',
      },
      { onConflict: 'profile_id,scope_type,country_code' },
    );

    if (activationError) {
      return {
        status: 'blocked',
        summary: 'Could not activate the requested civic scope.',
        details: { action_type: args.spec.actionType, error: activationError.message, profile_id: args.spec.profileId, scope_type: args.spec.scopeType, country_code: normalizedCountryCode },
      } satisfies GovernanceExecutionApplyResult;
    }

    const { error: profileUpdateError } = await args.client
      .from('profiles')
      .update({ is_active_citizen: true, active_citizen_since: new Date().toISOString() })
      .eq('id', args.spec.profileId);

    if (profileUpdateError) {
      return {
        status: 'blocked',
        summary: 'Could not project the active citizen state onto the profile.',
        details: { action_type: args.spec.actionType, error: profileUpdateError.message, profile_id: args.spec.profileId },
      } satisfies GovernanceExecutionApplyResult;
    }

    return {
      status: 'completed',
      summary: args.spec.scopeType === 'country'
        ? `Activated ${normalizedCountryCode} civic scope for profile ${args.spec.profileId}.`
        : `Activated world civic scope for profile ${args.spec.profileId}.`,
      details: { action_type: args.spec.actionType, profile_id: args.spec.profileId, scope_type: args.spec.scopeType, country_code: normalizedCountryCode },
    } satisfies GovernanceExecutionApplyResult;
  }

  const { error: deleteError } = await args.client
    .from('citizen_activation_scopes')
    .delete()
    .eq('profile_id', args.spec.profileId)
    .eq('scope_type', args.spec.scopeType)
    .eq('country_code', normalizedCountryCode);

  if (deleteError) {
    return {
      status: 'blocked',
      summary: 'Could not deactivate the requested civic scope.',
      details: { action_type: args.spec.actionType, error: deleteError.message, profile_id: args.spec.profileId, scope_type: args.spec.scopeType, country_code: normalizedCountryCode },
    } satisfies GovernanceExecutionApplyResult;
  }

  const { count: remainingScopeCount, error: remainingScopeError } = await args.client
    .from('citizen_activation_scopes')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', args.spec.profileId);

  if (remainingScopeError) {
    return {
      status: 'blocked',
      summary: 'Could not verify the remaining civic scope state.',
      details: { action_type: args.spec.actionType, error: remainingScopeError.message, profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  const stillActive = (remainingScopeCount || 0) > 0;
  const { error: profileUpdateError } = await args.client
    .from('profiles')
    .update({ is_active_citizen: stillActive })
    .eq('id', args.spec.profileId);

  if (profileUpdateError) {
    return {
      status: 'blocked',
      summary: 'Could not project the deactivated civic scope onto the profile.',
      details: { action_type: args.spec.actionType, error: profileUpdateError.message, profile_id: args.spec.profileId },
    } satisfies GovernanceExecutionApplyResult;
  }

  return {
    status: 'completed',
    summary: args.spec.scopeType === 'country'
      ? `Deactivated ${normalizedCountryCode} civic scope for profile ${args.spec.profileId}.`
      : `Deactivated world civic scope for profile ${args.spec.profileId}.`,
    details: { action_type: args.spec.actionType, profile_id: args.spec.profileId, scope_type: args.spec.scopeType, country_code: normalizedCountryCode, still_active: stillActive },
  } satisfies GovernanceExecutionApplyResult;
}
