import type { Database, Json } from '@/integrations/supabase/types';

export type GovernancePublicAuditBatchRow = Database['public']['Tables']['governance_public_audit_batches']['Row'];

export interface GovernancePublicAuditChainStatus {
  checkedBatchCount: number;
  linkValid: boolean;
  hashValid: boolean;
  valid: boolean;
  firstInvalidLinkBatchId: string | null;
  firstInvalidHashBatchId: string | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonNegativeInteger(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const next = Math.floor(value);
  return next >= 0 ? next : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function asNullableString(value: unknown) {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  return value;
}

export function readGovernancePublicAuditChainStatus(value: Json | null | undefined): GovernancePublicAuditChainStatus | null {
  if (!isObject(value)) return null;

  const checkedBatchCount = asNonNegativeInteger(value.checked_batch_count);
  const linkValid = asBoolean(value.link_valid);
  const hashValid = asBoolean(value.hash_valid);
  const valid = asBoolean(value.valid);

  if (checkedBatchCount === null || linkValid === null || hashValid === null || valid === null) {
    return null;
  }

  return {
    checkedBatchCount,
    linkValid,
    hashValid,
    valid,
    firstInvalidLinkBatchId: asNullableString(value.first_invalid_link_batch_id),
    firstInvalidHashBatchId: asNullableString(value.first_invalid_hash_batch_id),
  };
}

export function summarizeGovernancePublicAuditBatch(batch: GovernancePublicAuditBatchRow) {
  const anchored = Boolean(batch.anchored_at && batch.anchor_reference);

  return {
    anchored,
    eventCount: Math.max(0, Math.floor(batch.event_count)),
    hashPreview: `${batch.batch_hash.slice(0, 12)}...${batch.batch_hash.slice(-8)}`,
  };
}

export function isMissingPublicAuditAnchoringBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || message.includes('governance_public_audit_')
    || message.includes('capture_governance_public_audit_batch')
    || message.includes('verify_governance_public_audit_chain')
  );
}
