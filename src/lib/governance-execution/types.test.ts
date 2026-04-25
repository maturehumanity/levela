import { describe, expect, it } from 'vitest';

import {
  GOVERNANCE_EXECUTION_ACTION_TYPES,
  emptyGovernanceExecutionDraft,
  isActivationScopeType,
  isAppPermission,
  isAppRole,
  isGovernanceExecutionActionType,
  isGovernanceUnitMembershipRole,
  normalizeCountryCode,
} from './types';

describe('governance-execution types helpers', () => {
  it('exposes a stable empty execution draft baseline', () => {
    expect(emptyGovernanceExecutionDraft).toMatchObject({
      actionType: 'manual_follow_through',
      membershipRole: 'member',
      activationScopeType: 'world',
    });
  });

  it('isAppRole accepts only known roles', () => {
    expect(isAppRole('citizen')).toBe(true);
    expect(isAppRole('founder')).toBe(true);
    expect(isAppRole('not_a_role')).toBe(false);
    expect(isAppRole('')).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it('isAppPermission accepts only known permissions', () => {
    expect(isAppPermission('law.read')).toBe(true);
    expect(isAppPermission('settings.manage')).toBe(true);
    expect(isAppPermission('law.fake')).toBe(false);
    expect(isAppPermission('')).toBe(false);
  });

  it('isGovernanceExecutionActionType matches the canonical action list', () => {
    for (const action of GOVERNANCE_EXECUTION_ACTION_TYPES) {
      expect(isGovernanceExecutionActionType(action)).toBe(true);
    }

    expect(isGovernanceExecutionActionType('bogus_action')).toBe(false);
    expect(isGovernanceExecutionActionType('')).toBe(false);
  });

  it('isGovernanceUnitMembershipRole accepts lead, member, and observer', () => {
    expect(isGovernanceUnitMembershipRole('lead')).toBe(true);
    expect(isGovernanceUnitMembershipRole('member')).toBe(true);
    expect(isGovernanceUnitMembershipRole('observer')).toBe(true);
    expect(isGovernanceUnitMembershipRole('admin')).toBe(false);
    expect(isGovernanceUnitMembershipRole('')).toBe(false);
  });

  it('isActivationScopeType accepts world and country only', () => {
    expect(isActivationScopeType('world')).toBe(true);
    expect(isActivationScopeType('country')).toBe(true);
    expect(isActivationScopeType('region')).toBe(false);
  });

  it('normalizeCountryCode uppercases country scope codes and clears world scope', () => {
    expect(normalizeCountryCode('world', 'us')).toBe('');
    expect(normalizeCountryCode('country', '  gb  ')).toBe('GB');
    expect(normalizeCountryCode('country', 'de')).toBe('DE');
  });
});
