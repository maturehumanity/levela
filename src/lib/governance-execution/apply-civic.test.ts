import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';

import { applyActivationScopeExecution, applyVerificationExecution } from './apply-civic';
import type { GovernanceProposalExecutionSpec } from './types';

type ActivationSpec = Extract<
  GovernanceProposalExecutionSpec,
  { actionType: 'activate_citizen_scope' | 'deactivate_citizen_scope' }
>;

const activateCountrySpec: ActivationSpec = {
  actionType: 'activate_citizen_scope',
  autoExecutable: true,
  requestedUnitKey: 'civic_operations',
  profileId: 'profile-1',
  scopeType: 'country',
  countryCode: 'us',
  notes: null,
};

const deactivateCountrySpec: ActivationSpec = {
  actionType: 'deactivate_citizen_scope',
  autoExecutable: true,
  requestedUnitKey: 'civic_operations',
  profileId: 'profile-1',
  scopeType: 'country',
  countryCode: 'us',
  notes: null,
};

type VerificationSpec = Extract<
  GovernanceProposalExecutionSpec,
  { actionType: 'approve_identity_verification' | 'revoke_identity_verification' }
>;

const approveSpec: VerificationSpec = {
  actionType: 'approve_identity_verification',
  autoExecutable: true,
  requestedUnitKey: 'identity_verification',
  profileId: 'profile-1',
  notes: 'Steward notes',
};

const revokeSpec: VerificationSpec = {
  actionType: 'revoke_identity_verification',
  autoExecutable: true,
  requestedUnitKey: 'identity_verification',
  profileId: 'profile-1',
  notes: null,
};

const completeCase = {
  id: 'case-1',
  profile_id: 'profile-1',
  personal_info_completed: true,
  contact_info_completed: true,
  live_verification_completed: true,
  notes: 'Existing',
};

function buildVerificationClient(options: {
  caseRow?: typeof completeCase | null;
  lookupError?: { message: string } | null;
  updateError?: { message: string } | null;
  reviewInsertError?: { message: string } | null;
}) {
  let casesFromInvocation = 0;
  const insert = vi.fn().mockResolvedValue({ error: options.reviewInsertError ?? null });
  const updateEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.caseRow === undefined ? completeCase : options.caseRow,
    error: options.lookupError ?? null,
  });

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'identity_verification_reviews') {
        return { insert };
      }
      if (table === 'identity_verification_cases') {
        casesFromInvocation += 1;
        if (casesFromInvocation === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle,
          };
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: updateEq,
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    insert,
    updateEq,
    maybeSingle,
  };
}

function buildActivateScopeClient(options: {
  citizenship?: 'citizen' | 'registered_member';
  profileMissing?: boolean;
  profileLookupError?: { message: string } | null;
  activationRow?: { status: string; declared_at: string | null } | null;
  activationLookupError?: { message: string } | null;
  upsertError?: { message: string } | null;
  profilePatchError?: { message: string } | null;
}) {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: options.profileMissing
      ? null
      : { id: 'profile-1', citizenship_status: options.citizenship ?? 'citizen' },
    error: options.profileLookupError ?? null,
  });

  const activationMaybeSingle = vi.fn().mockResolvedValue({
    data:
      options.activationRow === undefined
        ? { status: 'activated', declared_at: '2026-01-01T00:00:00.000Z' }
        : options.activationRow,
    error: options.activationLookupError ?? null,
  });

  const upsert = vi.fn().mockResolvedValue({ error: options.upsertError ?? null });
  const profileUpdateEq = vi.fn().mockResolvedValue({ error: options.profilePatchError ?? null });

  let profilesFromCount = 0;
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        profilesFromCount += 1;
        if (profilesFromCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: profileMaybeSingle,
          };
        }
        return {
          update: vi.fn().mockReturnValue({ eq: profileUpdateEq }),
        };
      }
      if (table === 'activation_threshold_reviews') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: activationMaybeSingle,
        };
      }
      if (table === 'citizen_activation_scopes') {
        return { upsert };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    upsert,
    profileUpdateEq,
    activationMaybeSingle,
  };
}

function buildDeactivateScopeClient(options: {
  profileMissing?: boolean;
  deleteError?: { message: string } | null;
  countError?: { message: string } | null;
  remainingCount?: number | null;
  profilePatchError?: { message: string } | null;
}) {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: options.profileMissing ? null : { id: 'profile-1', citizenship_status: 'citizen' },
    error: null,
  });

  const deleteThirdEq = vi.fn().mockResolvedValue({ error: options.deleteError ?? null });
  const deleteSecondEq = vi.fn().mockReturnValue({ eq: deleteThirdEq });
  const deleteFirstEq = vi.fn().mockReturnValue({ eq: deleteSecondEq });

  const countEq = vi.fn().mockResolvedValue({
    count: options.remainingCount ?? 0,
    error: options.countError ?? null,
  });

  const profileUpdateEq = vi.fn().mockResolvedValue({ error: options.profilePatchError ?? null });

  let profilesFromCount = 0;
  let scopesFromCount = 0;

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        profilesFromCount += 1;
        if (profilesFromCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: profileMaybeSingle,
          };
        }
        return {
          update: vi.fn().mockReturnValue({ eq: profileUpdateEq }),
        };
      }
      if (table === 'citizen_activation_scopes') {
        scopesFromCount += 1;
        if (scopesFromCount === 1) {
          return {
            delete: vi.fn().mockReturnValue({ eq: deleteFirstEq }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: countEq,
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    profileUpdateEq,
    countEq,
    deleteFirstEq,
  };
}

describe('apply-civic applyVerificationExecution', () => {
  it('blocks when the verification case lookup fails', async () => {
    const { client } = buildVerificationClient({ lookupError: { message: 'rpc down' } });

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-1',
      spec: approveSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not load');
    expect(result.details).toMatchObject({ error: 'rpc down', profile_id: 'profile-1' });
  });

  it('blocks when no verification case exists', async () => {
    const { client } = buildVerificationClient({ caseRow: null });

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-1',
      spec: approveSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('No identity verification case');
  });

  it('blocks approval when required verification steps are incomplete', async () => {
    const { client } = buildVerificationClient({
      caseRow: {
        ...completeCase,
        live_verification_completed: false,
      },
    });

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-1',
      spec: approveSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('incomplete');
    expect(result.details).toMatchObject({
      live_verification_completed: false,
    });
  });

  it('allows revocation even when verification steps are incomplete', async () => {
    const { client, insert, updateEq } = buildVerificationClient({
      caseRow: {
        ...completeCase,
        personal_info_completed: false,
        contact_info_completed: false,
        live_verification_completed: false,
      },
    });

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-2',
      spec: revokeSpec,
    });

    expect(result.status).toBe('completed');
    expect(updateEq).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'revoked',
        reviewer_id: 'actor-2',
      }),
    );
  });

  it('completes approval when the case is fully satisfied', async () => {
    const { client, insert, updateEq } = buildVerificationClient({});

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-3',
      spec: approveSpec,
    });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Approved identity verification');
    expect(updateEq).toHaveBeenCalledWith('id', 'case-1');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'approved',
        reviewer_id: 'actor-3',
      }),
    );
  });

  it('blocks when the case row update fails', async () => {
    const { client, insert } = buildVerificationClient({ updateError: { message: 'update denied' } });

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-1',
      spec: approveSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not update');
    expect(insert).not.toHaveBeenCalled();
  });

  it('blocks when the review insert fails', async () => {
    const { client } = buildVerificationClient({ reviewInsertError: { message: 'insert denied' } });

    const result = await applyVerificationExecution({
      client,
      actorId: 'actor-1',
      spec: approveSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not record');
  });
});

describe('apply-civic applyActivationScopeExecution', () => {
  it('blocks activation when the citizen profile cannot be loaded', async () => {
    const { client } = buildActivateScopeClient({ profileLookupError: { message: 'db read' } });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not load the target citizen profile');
  });

  it('blocks activation when the profile is missing', async () => {
    const { client } = buildActivateScopeClient({ profileMissing: true });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.details).toMatchObject({ profile_id: 'profile-1' });
  });

  it('blocks activation when the target is not a citizen', async () => {
    const { client } = buildActivateScopeClient({ citizenship: 'registered_member' });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Only citizens can be activated');
  });

  it('blocks activation when activation declaration state cannot be loaded', async () => {
    const { client } = buildActivateScopeClient({ activationLookupError: { message: 'review rpc' } });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not load activation declaration');
  });

  it('blocks activation when the scope has not been formally declared', async () => {
    const { client } = buildActivateScopeClient({
      activationRow: { status: 'pending', declared_at: null },
    });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('has not been formally declared');
  });

  it('completes activation after upserting scope and updating the profile', async () => {
    const { client, upsert, profileUpdateEq } = buildActivateScopeClient({});

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-9',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('US');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: 'profile-1',
        scope_type: 'country',
        country_code: 'US',
        activated_by: 'actor-9',
      }),
      { onConflict: 'profile_id,scope_type,country_code' },
    );
    expect(profileUpdateEq).toHaveBeenCalledWith('id', 'profile-1');
  });

  it('does not update the profile when scope upsert fails', async () => {
    const { client, profileUpdateEq } = buildActivateScopeClient({ upsertError: { message: 'denied' } });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: activateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(profileUpdateEq).not.toHaveBeenCalled();
  });

  it('completes deactivation and clears active citizen when no scopes remain', async () => {
    const { client, profileUpdateEq } = buildDeactivateScopeClient({});

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-2',
      spec: deactivateCountrySpec,
    });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Deactivated');
    expect(profileUpdateEq).toHaveBeenCalledWith('id', 'profile-1');
    expect(result.details).toMatchObject({ still_active: false });
  });

  it('blocks deactivation when counting remaining scopes fails', async () => {
    const { client, profileUpdateEq } = buildDeactivateScopeClient({ countError: { message: 'head failed' } });

    const result = await applyActivationScopeExecution({
      client,
      actorId: 'actor-1',
      spec: deactivateCountrySpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not verify the remaining civic scope');
    expect(profileUpdateEq).not.toHaveBeenCalled();
  });
});
