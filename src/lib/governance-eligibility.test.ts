import { describe, expect, it } from 'vitest';

import {
  FOUNDER_GOVERNANCE_SCORE,
  MIN_GOVERNANCE_SCORE,
  evaluateGovernanceEligibility,
  normalizeGovernanceScoreForRole,
} from './governance-eligibility';

describe('governance-eligibility', () => {
  it('assigns zero influence weight to unverified users', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: false,
        score: 95,
        isNativeMobileApp: true,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: ['verified_required'],
    });
  });

  it('assigns zero influence weight to web users even with high scores', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        score: 95,
        isNativeMobileApp: false,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: ['mobile_app_required'],
    });
  });

  it('assigns zero influence weight below the minimum score', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        score: MIN_GOVERNANCE_SCORE - 0.1,
        isNativeMobileApp: true,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: ['minimum_score_required'],
    });
  });

  it('allows verified native-mobile citizens above the minimum score', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        score: MIN_GOVERNANCE_SCORE,
        isNativeMobileApp: true,
      }),
    ).toEqual({
      eligible: true,
      influenceWeight: 1,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: [],
    });
  });

  it('assigns the founder a governance score floor of 70', () => {
    expect(normalizeGovernanceScoreForRole('founder', 12.4)).toBe(FOUNDER_GOVERNANCE_SCORE);
    expect(normalizeGovernanceScoreForRole('founder', 96.2)).toBe(96.2);
  });

  it('normalizes non-founder scores without a floor', () => {
    expect(normalizeGovernanceScoreForRole('citizen', 42.5)).toBe(42.5);
    expect(normalizeGovernanceScoreForRole('citizen', null)).toBeNull();
  });

  it('marks score unavailable when endorsements are missing', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        score: null,
        isNativeMobileApp: true,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: ['score_unavailable'],
    });
  });

  it('accumulates eligibility reasons in stable order', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: false,
        score: null,
        isNativeMobileApp: false,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: ['mobile_app_required', 'verified_required', 'score_unavailable'],
    });
  });

  it('allows a verified founder on native mobile even when endorsements are below the threshold', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        role: 'founder',
        score: 12.4,
        isNativeMobileApp: true,
      }),
    ).toEqual({
      eligible: true,
      influenceWeight: 1,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: [],
    });
  });

  it('honors a caller-provided minimum governance score override', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        score: 80,
        isNativeMobileApp: true,
        minScore: 90,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: 90,
      reasons: ['minimum_score_required'],
    });
  });

  it('applies the founder score floor before comparing against a raised minScore', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        role: 'founder',
        score: 12.4,
        isNativeMobileApp: true,
        minScore: 90,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: 90,
      reasons: ['minimum_score_required'],
    });
  });

  it('treats a null score as unavailable even for founders', () => {
    expect(
      evaluateGovernanceEligibility({
        isVerified: true,
        role: 'founder',
        score: null,
        isNativeMobileApp: true,
      }),
    ).toEqual({
      eligible: false,
      influenceWeight: 0,
      minScore: MIN_GOVERNANCE_SCORE,
      reasons: ['score_unavailable'],
    });
  });

  it('passes through scores when role is undefined', () => {
    expect(normalizeGovernanceScoreForRole(undefined, 55)).toBe(55);
  });
});
