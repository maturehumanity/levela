import type { Database } from '@/integrations/supabase/types';

export type AgreementRow = Database['public']['Tables']['agreements']['Row'];
export type AgreementTemplateKey = 'core' | 'product' | 'service';

export const AGREEMENT_TEMPLATE_KEYS: AgreementTemplateKey[] = ['core', 'product', 'service'];

export function agreementTemplateFromListingKind(listingKind: string | null | undefined): AgreementTemplateKey {
  return listingKind === 'service' ? 'service' : 'product';
}
