import { describe, expect, it } from 'vitest';

import type { ActivationDemographicFeedAdapterRow } from '@/lib/governance-activation-demographic-feeds';
import { buildFallbackWorkerAlertRows } from '@/lib/governance-activation-demographic-feed-workers';

function adapter(partial: Partial<ActivationDemographicFeedAdapterRow>): ActivationDemographicFeedAdapterRow {
  return {
    id: 'adapter-default',
    adapter_key: 'default_key',
    adapter_name: 'Default adapter',
    adapter_type: 'signed_json_feed',
    added_by: null,
    country_code: '',
    created_at: '2026-01-01T00:00:00.000Z',
    endpoint_url: null,
    is_active: true,
    key_algorithm: 'ECDSA_P256_SHA256_V1',
    last_ingested_at: null,
    metadata: {},
    public_signer_key: 'pk',
    scope_type: 'world',
    updated_at: '2026-01-01T00:00:00.000Z',
    worker_sweep_interval_minutes: null,
    ...partial,
  };
}

describe('buildFallbackWorkerAlertRows', () => {
  it('returns an empty list when no adapters are active', () => {
    expect(buildFallbackWorkerAlertRows([adapter({ is_active: false })])).toEqual([]);
  });

  it('omits inactive adapters from a mixed list', () => {
    const rows = buildFallbackWorkerAlertRows([
      adapter({ id: 'active-one', is_active: true }),
      adapter({ id: 'inactive-one', is_active: false }),
    ]);
    expect(rows.map((row) => row.adapter_id)).toEqual(['active-one']);
  });

  it('maps active adapters to synthetic alert summary rows with zeroed failure counters', () => {
    const fresh = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rows = buildFallbackWorkerAlertRows([
      adapter({
        id: 'a1',
        adapter_key: 'world_primary',
        adapter_name: 'World feed',
        scope_type: 'world',
        country_code: '',
        last_ingested_at: fresh,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      adapter_id: 'a1',
      adapter_key: 'world_primary',
      adapter_name: 'World feed',
      scope_type: 'world',
      country_code: '',
      last_ingested_at: fresh,
      freshness_alert: false,
      stale_by_hours: null,
      signature_failure_count: 0,
      connectivity_failure_count: 0,
      payload_failure_count: 0,
      latest_run_status: null,
      latest_run_message: null,
      latest_run_at: null,
    });
  });

  it('flags freshness on the fallback row when ingestion is missing or stale', () => {
    const missing = buildFallbackWorkerAlertRows([adapter({ id: 'm1', last_ingested_at: null })]);
    expect(missing[0]?.freshness_alert).toBe(true);

    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const stale = buildFallbackWorkerAlertRows([adapter({ id: 's1', last_ingested_at: old })]);
    expect(stale[0]?.freshness_alert).toBe(true);
  });
});
