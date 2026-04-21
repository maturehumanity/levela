import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import type { GovernanceEligibilityReason } from '@/lib/governance-eligibility';

type GovernanceEligibilitySnapshotInsert = Database['public']['Tables']['governance_eligibility_snapshots']['Insert'];
type GovernanceProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type GovernanceSnapshotClient = SupabaseClient<Database>;

export type GovernanceEligibilitySnapshotPayload = {
  profileId: string;
  citizenshipStatus: Database['public']['Enums']['citizenship_status'];
  isVerified: boolean;
  isActiveCitizen: boolean;
  levelaScore: number;
  governanceScore: number;
  eligible: boolean;
  influenceWeight: number;
  reasons: readonly GovernanceEligibilityReason[];
  calculatedAt?: string;
  calculationVersion?: string;
  source?: string;
};

function normalizeScore(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value ?? 0) * 100) / 100;
}

export function buildGovernanceEligibilitySnapshot(
  payload: GovernanceEligibilitySnapshotPayload,
): GovernanceEligibilitySnapshotInsert {
  return {
    profile_id: payload.profileId,
    citizenship_status: payload.citizenshipStatus,
    is_verified: payload.isVerified,
    is_active_citizen: payload.isActiveCitizen,
    levela_score: normalizeScore(payload.levelaScore),
    governance_score: normalizeScore(payload.governanceScore),
    influence_weight: payload.influenceWeight,
    eligible: payload.eligible,
    reason_codes: [...payload.reasons],
    calculated_at: payload.calculatedAt ?? new Date().toISOString(),
    calculation_version: payload.calculationVersion ?? 'phase1-v1',
    source: payload.source ?? 'client_projection',
  };
}

export function buildGovernanceEligibilityProfilePatch(
  payload: GovernanceEligibilitySnapshotPayload,
): GovernanceProfileUpdate {
  return {
    is_governance_eligible: payload.eligible,
    governance_eligible_at: payload.eligible ? payload.calculatedAt ?? new Date().toISOString() : null,
  };
}

export async function persistGovernanceEligibilitySnapshot(
  client: GovernanceSnapshotClient,
  payload: GovernanceEligibilitySnapshotPayload,
) {
  const snapshot = buildGovernanceEligibilitySnapshot(payload);
  const profilePatch = buildGovernanceEligibilityProfilePatch(payload);

  const snapshotResponse = await client
    .from('governance_eligibility_snapshots')
    .upsert(snapshot, { onConflict: 'profile_id' });

  if (snapshotResponse.error) {
    return { error: snapshotResponse.error };
  }

  const profileResponse = await client
    .from('profiles')
    .update(profilePatch)
    .eq('id', payload.profileId);

  return { error: profileResponse.error };
}

export function sameGovernanceEligibilitySnapshot(
  left: GovernanceEligibilitySnapshotPayload,
  right: GovernanceEligibilitySnapshotPayload,
) {
  const leftReasons = [...left.reasons].sort().join('|');
  const rightReasons = [...right.reasons].sort().join('|');

  return (
    left.profileId === right.profileId
    && left.citizenshipStatus === right.citizenshipStatus
    && left.isVerified === right.isVerified
    && left.isActiveCitizen === right.isActiveCitizen
    && normalizeScore(left.levelaScore) === normalizeScore(right.levelaScore)
    && normalizeScore(left.governanceScore) === normalizeScore(right.governanceScore)
    && left.eligible === right.eligible
    && left.influenceWeight === right.influenceWeight
    && leftReasons === rightReasons
  );
}
