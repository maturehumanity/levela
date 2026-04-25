import { describe, expect, it } from 'vitest';

import {
  readFailoverPolicyRecord,
  readGovernancePublicAuditVerifierMirrorDirectorySummaryRows,
  readGovernancePublicAuditVerifierMirrorDirectoryTrustSummary,
  readGovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  readGovernancePublicAuditVerifierMirrorProbeJobSummary,
} from '@/lib/governance-public-audit-verifier-mirror-production';

describe('governance-public-audit-verifier-mirror-production helpers', () => {
  it('parses failover policy records when required keys are present', () => {
    const policy = readFailoverPolicyRecord({
      policy_id: 'p1',
      policy_key: 'default',
      policy_name: 'Default policy',
      is_active: true,
      min_healthy_mirrors: 2,
      max_mirror_latency_ms: 3000,
    });

    expect(policy).toMatchObject({
      policyId: 'p1',
      policyKey: 'default',
      policyName: 'Default policy',
      isActive: true,
      minHealthyMirrors: 2,
      maxMirrorLatencyMs: 3000,
    });
  });

  it('returns null for absent or incomplete failover policy records', () => {
    expect(readFailoverPolicyRecord(null)).toBeNull();
    expect(readFailoverPolicyRecord({ policy_key: '', policy_name: 'Name' })).toBeNull();
    expect(readFailoverPolicyRecord({ policy_key: 'k', policy_name: '' })).toBeNull();
  });

  it('returns null when failover policy RPC rows are empty', () => {
    expect(readGovernancePublicAuditVerifierMirrorFailoverPolicySummary(null)).toBeNull();
    expect(readGovernancePublicAuditVerifierMirrorFailoverPolicySummary([])).toBeNull();
  });

  it('returns an empty directory summary list for non-array inputs', () => {
    expect(readGovernancePublicAuditVerifierMirrorDirectorySummaryRows(null)).toEqual([]);
    expect(readGovernancePublicAuditVerifierMirrorDirectorySummaryRows({})).toEqual([]);
  });

  it('returns null when probe job summary RPC rows are absent', () => {
    expect(readGovernancePublicAuditVerifierMirrorProbeJobSummary(null)).toBeNull();
    expect(readGovernancePublicAuditVerifierMirrorProbeJobSummary([])).toBeNull();
  });

  it('returns null when directory trust summary rows are incomplete', () => {
    expect(readGovernancePublicAuditVerifierMirrorDirectoryTrustSummary(null)).toBeNull();
    expect(
      readGovernancePublicAuditVerifierMirrorDirectoryTrustSummary([
        {
          directory_id: null,
          directory_hash: null,
          published_at: null,
        },
      ]),
    ).toBeNull();
  });
});
