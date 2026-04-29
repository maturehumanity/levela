import { describe, expect, it } from 'vitest';

import {
  readActivationFeedWorkerEscalationPolicyEventRows,
  readActivationFeedWorkerEscalationPolicySummary,
} from '@/lib/governance-activation-feed-worker-escalation-policy';

describe('readActivationFeedWorkerEscalationPolicySummary', () => {
  it('returns null for empty rows', () => {
    expect(readActivationFeedWorkerEscalationPolicySummary([])).toBeNull();
    expect(readActivationFeedWorkerEscalationPolicySummary(null)).toBeNull();
  });

  it('maps the first summary row', () => {
    const row = readActivationFeedWorkerEscalationPolicySummary([
      {
        policy_key: 'default',
        policy_name: 'Test policy',
        escalation_enabled: false,
        freshness_hours: 12,
        minimum_adapter_issues_for_escalation: 2,
        escalation_severity: 'warning',
        policy_schema_version: 1,
        metadata: { a: 1 },
        updated_at: '2026-01-02T00:00:00.000Z',
        updated_by: null,
        updated_by_name: 'steward',
      },
    ]);
    expect(row).toMatchObject({
      policy_key: 'default',
      policy_name: 'Test policy',
      escalation_enabled: false,
      freshness_hours: 12,
      minimum_adapter_issues_for_escalation: 2,
      escalation_severity: 'warning',
      policy_schema_version: 1,
      metadata: { a: 1 },
      updated_at: '2026-01-02T00:00:00.000Z',
      updated_by: null,
      updated_by_name: 'steward',
    });
  });
});

describe('readActivationFeedWorkerEscalationPolicyEventRows', () => {
  it('returns empty for non-arrays', () => {
    expect(readActivationFeedWorkerEscalationPolicyEventRows(null)).toEqual([]);
  });

  it('maps event rows and drops invalid entries', () => {
    const rows = readActivationFeedWorkerEscalationPolicyEventRows([
      {
        event_id: '00000000-0000-4000-8000-000000000001',
        policy_key: 'default',
        event_type: 'updated',
        actor_profile_id: null,
        actor_name: 'Ada',
        event_message: 'Freshness window changed',
        metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
      },
      { event_id: '', event_type: 'x' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event_message).toBe('Freshness window changed');
  });
});
