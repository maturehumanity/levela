import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';

import { applyRolePermissionExecution, applyUnitMembershipExecution } from './apply-access';
import type { GovernanceExecutionUnitRow, GovernanceProposalExecutionSpec } from './types';

type RolePermissionSpec = Extract<
  GovernanceProposalExecutionSpec,
  { actionType: 'grant_role_permission' | 'revoke_role_permission' }
>;

const grantRoleSpec: RolePermissionSpec = {
  actionType: 'grant_role_permission',
  autoExecutable: true,
  requestedUnitKey: 'policy_legal',
  role: 'moderator',
  permission: 'law.review',
};

const revokeRoleSpec: RolePermissionSpec = {
  actionType: 'revoke_role_permission',
  autoExecutable: true,
  requestedUnitKey: 'policy_legal',
  role: 'moderator',
  permission: 'law.review',
};

type UnitMembershipSpec = Extract<
  GovernanceProposalExecutionSpec,
  { actionType: 'assign_unit_member' | 'deactivate_unit_member' }
>;

const assignUnitSpec: UnitMembershipSpec = {
  actionType: 'assign_unit_member',
  autoExecutable: true,
  requestedUnitKey: 'civic_operations',
  targetUnitKey: 'security_response',
  profileId: 'profile-1',
  membershipRole: 'lead',
  notes: null,
};

const deactivateUnitSpec: UnitMembershipSpec = {
  actionType: 'deactivate_unit_member',
  autoExecutable: true,
  requestedUnitKey: 'civic_operations',
  targetUnitKey: 'security_response',
  profileId: 'profile-1',
  membershipRole: 'lead',
  notes: 'Rotation complete',
};

const sampleUnit: GovernanceExecutionUnitRow = {
  id: 'unit-1',
  unit_key: 'security_response',
  name: 'Security response',
  description: '',
  domain_key: 'civic_operations',
  is_active: true,
  is_system_unit: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function buildRolePermissionClient(options: { grantError?: { message: string } | null; revokeError?: { message: string } | null }) {
  const upsert = vi.fn().mockResolvedValue({ error: options.grantError ?? null });
  const deleteInnerEq = vi.fn().mockResolvedValue({ error: options.revokeError ?? null });
  const deleteOuterEq = vi.fn().mockReturnValue({ eq: deleteInnerEq });

  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'role_permissions') throw new Error(`unexpected table ${table}`);
      return {
        upsert,
        delete: vi.fn().mockReturnValue({ eq: deleteOuterEq }),
      };
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    upsert,
    deleteOuterEq,
    deleteInnerEq,
  };
}

function buildUnitMembershipClient(options: { upsertError?: { message: string } | null; updateError?: { message: string } | null }) {
  const upsert = vi.fn().mockResolvedValue({ error: options.upsertError ?? null });
  const updateInnerEq = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const updateOuterEq = vi.fn().mockReturnValue({ eq: updateInnerEq });

  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'governance_execution_unit_memberships') throw new Error(`unexpected table ${table}`);
      return {
        upsert,
        update: vi.fn().mockReturnValue({ eq: updateOuterEq }),
      };
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    upsert,
    updateOuterEq,
    updateInnerEq,
  };
}

describe('apply-access applyRolePermissionExecution', () => {
  it('grants a role permission when upsert succeeds', async () => {
    const { client, upsert } = buildRolePermissionClient({});

    const result = await applyRolePermissionExecution({ client, spec: grantRoleSpec });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Granted');
    expect(upsert).toHaveBeenCalledWith(
      { role: 'moderator', permission: 'law.review' },
      { onConflict: 'role,permission' },
    );
  });

  it('blocks when grant upsert fails', async () => {
    const { client } = buildRolePermissionClient({ grantError: { message: 'denied' } });

    const result = await applyRolePermissionExecution({ client, spec: grantRoleSpec });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not grant');
  });

  it('revokes a role permission when delete succeeds', async () => {
    const { client, deleteOuterEq, deleteInnerEq } = buildRolePermissionClient({});

    const result = await applyRolePermissionExecution({ client, spec: revokeRoleSpec });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Revoked');
    expect(deleteOuterEq).toHaveBeenCalledWith('role', 'moderator');
    expect(deleteInnerEq).toHaveBeenCalledWith('permission', 'law.review');
  });

  it('blocks when revoke delete fails', async () => {
    const { client } = buildRolePermissionClient({ revokeError: { message: 'denied' } });

    const result = await applyRolePermissionExecution({ client, spec: revokeRoleSpec });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not revoke');
  });
});

describe('apply-access applyUnitMembershipExecution', () => {
  it('blocks assignment when the execution unit is unknown', async () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

    const result = await applyUnitMembershipExecution({
      client,
      actorId: 'actor-1',
      unitsByKey: {},
      spec: assignUnitSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('was not found');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('assigns a member when upsert succeeds', async () => {
    const { client, upsert } = buildUnitMembershipClient({});

    const result = await applyUnitMembershipExecution({
      client,
      actorId: 'actor-2',
      unitsByKey: { 'security_response': sampleUnit },
      spec: assignUnitSpec,
    });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Assigned');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        unit_id: 'unit-1',
        profile_id: 'profile-1',
        membership_role: 'lead',
        assigned_by: 'actor-2',
        is_active: true,
      }),
      { onConflict: 'unit_id,profile_id' },
    );
  });

  it('blocks assignment when upsert fails', async () => {
    const { client } = buildUnitMembershipClient({ upsertError: { message: 'rls' } });

    const result = await applyUnitMembershipExecution({
      client,
      actorId: 'actor-1',
      unitsByKey: { 'security_response': sampleUnit },
      spec: assignUnitSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not assign');
  });

  it('deactivates a member when update succeeds', async () => {
    const { client, updateOuterEq, updateInnerEq } = buildUnitMembershipClient({});

    const result = await applyUnitMembershipExecution({
      client,
      actorId: 'actor-3',
      unitsByKey: { 'security_response': sampleUnit },
      spec: deactivateUnitSpec,
    });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Deactivated');
    expect(updateOuterEq).toHaveBeenCalledWith('unit_id', 'unit-1');
    expect(updateInnerEq).toHaveBeenCalledWith('profile_id', 'profile-1');
  });

  it('blocks deactivation when update fails', async () => {
    const { client } = buildUnitMembershipClient({ updateError: { message: 'rls' } });

    const result = await applyUnitMembershipExecution({
      client,
      actorId: 'actor-1',
      unitsByKey: { 'security_response': sampleUnit },
      spec: deactivateUnitSpec,
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('Could not deactivate');
  });
});
