import { describe, expect, it } from 'vitest';

import {
  buildGovernanceEligibilityProfilePatch,
  buildGovernanceEligibilitySnapshot,
  sameGovernanceEligibilitySnapshot,
} from './governance-eligibility-snapshots';

describe('governance-eligibility-snapshots', () => {
  const payload = {
    profileId: 'profile-1',
    citizenshipStatus: 'citizen' as const,
    isVerified: true,
    isActiveCitizen: true,
    levelaScore: 72.345,
    governanceScore: 80.111,
    eligible: true,
    influenceWeight: 1,
    reasons: [] as const,
    calculatedAt: '2026-04-18T12:00:00.000Z',
  };

  it('builds a normalized snapshot row', () => {
    expect(buildGovernanceEligibilitySnapshot(payload)).toEqual({
      profile_id: 'profile-1',
      citizenship_status: 'citizen',
      is_verified: true,
      is_active_citizen: true,
      levela_score: 72.35,
      governance_score: 80.11,
      influence_weight: 1,
      eligible: true,
      reason_codes: [],
      calculated_at: '2026-04-18T12:00:00.000Z',
      calculation_version: 'phase1-v1',
      source: 'client_projection',
    });
  });

  it('builds a matching profile patch', () => {
    expect(buildGovernanceEligibilityProfilePatch(payload)).toEqual({
      is_governance_eligible: true,
      governance_eligible_at: '2026-04-18T12:00:00.000Z',
    });
  });

  it('compares snapshots without caring about reason order', () => {
    expect(
      sameGovernanceEligibilitySnapshot(
        { ...payload, reasons: ['verified_required', 'mobile_app_required'] },
        { ...payload, reasons: ['mobile_app_required', 'verified_required'] },
      ),
    ).toBe(true);
  });
});
