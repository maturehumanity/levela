export function isMissingAgreementsBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('agreements') || message.includes('create_agreement_from_listing');
}
