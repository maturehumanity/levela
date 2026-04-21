import { Capacitor } from '@capacitor/core';

import type { AppRole } from './access-control';
import { SCORE_THRESHOLDS } from './constants';

export const MIN_GOVERNANCE_SCORE = SCORE_THRESHOLDS.medium;
export const FOUNDER_GOVERNANCE_SCORE = MIN_GOVERNANCE_SCORE;

export type GovernanceEligibilityReason =
  | 'mobile_app_required'
  | 'verified_required'
  | 'minimum_score_required'
  | 'score_unavailable';

export type GovernanceEligibilityResult = {
  eligible: boolean;
  influenceWeight: 0 | 1;
  minScore: number;
  reasons: GovernanceEligibilityReason[];
};

export function isNativeGovernanceApp() {
  if (!Capacitor.isNativePlatform()) return false;

  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios';
}

export function normalizeGovernanceScoreForRole(role: AppRole | null | undefined, score: number | null) {
  if (score === null) return null;
  if (role === 'founder') return Math.max(score, FOUNDER_GOVERNANCE_SCORE);
  return score;
}

export function evaluateGovernanceEligibility(input: {
  isVerified: boolean;
  role?: AppRole | null;
  score: number | null;
  isNativeMobileApp: boolean;
  minScore?: number;
}): GovernanceEligibilityResult {
  const minScore = input.minScore ?? MIN_GOVERNANCE_SCORE;
  const normalizedScore = normalizeGovernanceScoreForRole(input.role, input.score);
  const reasons: GovernanceEligibilityReason[] = [];

  if (!input.isNativeMobileApp) {
    reasons.push('mobile_app_required');
  }

  if (!input.isVerified) {
    reasons.push('verified_required');
  }

  if (normalizedScore === null) {
    reasons.push('score_unavailable');
  } else if (normalizedScore < minScore) {
    reasons.push('minimum_score_required');
  }

  return {
    eligible: reasons.length === 0,
    influenceWeight: reasons.length === 0 ? 1 : 0,
    minScore,
    reasons,
  };
}
