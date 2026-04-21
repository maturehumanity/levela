import type { Database } from '@/integrations/supabase/types';

export type ActivationThresholdReviewRow = Database['public']['Tables']['activation_threshold_reviews']['Row'];
export type ActivationReviewStatus = Database['public']['Enums']['activation_review_status'];

export function isActivationScopeDeclared(
  review: Pick<ActivationThresholdReviewRow, 'status' | 'declared_at'> | null | undefined,
) {
  return Boolean(review && review.status === 'activated' && review.declared_at);
}
