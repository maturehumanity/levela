function isMissingNamedRelationError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  nameToken: string,
) {
  if (!error) return false;
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  return Boolean(error.message?.toLowerCase().includes(nameToken));
}

export function isMissingLinkedAccountsTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  return isMissingNamedRelationError(error, 'linked_accounts');
}

export function isMissingBusinessAccessRequestsTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  return isMissingNamedRelationError(error, 'business_account_access_requests');
}

export function isDuplicateLinkError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  return error.code === '23505' || Boolean(error.message?.toLowerCase().includes('duplicate'));
}
