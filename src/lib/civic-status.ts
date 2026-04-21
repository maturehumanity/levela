import type { Database } from '@/integrations/supabase/types';
import type { AppRole } from '@/lib/access-control';

export const CITIZENSHIP_STATUSES = ['registered_member', 'verified_member', 'citizen'] as const;

export type CitizenshipStatus = Database['public']['Enums']['citizenship_status'];

const citizenshipStatusRank: Record<CitizenshipStatus, number> = {
  registered_member: 0,
  verified_member: 1,
  citizen: 2,
};

const projectedCitizenRoles = new Set<AppRole>([
  'citizen',
  'certified',
  'moderator',
  'market_manager',
  'founder',
  'admin',
  'system',
]);

export function deriveProjectedCitizenshipStatus(role: AppRole | null | undefined, isVerified: boolean) {
  if (role && projectedCitizenRoles.has(role)) {
    return 'citizen' satisfies CitizenshipStatus;
  }

  if (isVerified) {
    return 'verified_member' satisfies CitizenshipStatus;
  }

  return 'registered_member' satisfies CitizenshipStatus;
}

export function coerceCitizenshipStatus(
  currentStatus: CitizenshipStatus | null | undefined,
  projectedStatus: CitizenshipStatus,
) {
  if (!currentStatus) return projectedStatus;
  return citizenshipStatusRank[currentStatus] >= citizenshipStatusRank[projectedStatus]
    ? currentStatus
    : projectedStatus;
}

export function getCitizenStatusLabelKey(status: CitizenshipStatus) {
  switch (status) {
    case 'citizen':
      return 'admin.users.citizenshipStatuses.citizen';
    case 'verified_member':
      return 'admin.users.citizenshipStatuses.verified_member';
    case 'registered_member':
    default:
      return 'admin.users.citizenshipStatuses.registered_member';
  }
}
