import {
  getGovernanceDomainMaturityDeficits,
  getGovernanceDomainMaturityProgress,
  getGovernanceDomainMaturityState,
  parseGovernanceDomainThresholdResults,
} from '@/lib/governance-maturity';

describe('governance-maturity helpers', () => {
  it('parses threshold results and ignores malformed entries', () => {
    const parsed = parseGovernanceDomainThresholdResults([
      {
        threshold_key: 'stewards_minimum',
        threshold_name: 'Minimum Stewards',
        required_count: 5,
        observed_count: 3,
        meets_threshold: false,
        role_keys: ['steward'],
      },
      {
        threshold_key: 'invalid',
        required_count: 1,
      },
    ] as never);

    expect(parsed).toEqual([
      {
        thresholdKey: 'stewards_minimum',
        thresholdName: 'Minimum Stewards',
        requiredCount: 5,
        observedCount: 3,
        meetsThreshold: false,
        roleKeys: ['steward'],
      },
    ]);
  });

  it('computes maturity progress from snapshot counts', () => {
    expect(getGovernanceDomainMaturityProgress({ threshold_count: 3, thresholds_met_count: 2 })).toEqual({
      thresholdCount: 3,
      thresholdsMetCount: 2,
      percentage: 67,
    });
    expect(getGovernanceDomainMaturityProgress(null)).toEqual({
      thresholdCount: 0,
      thresholdsMetCount: 0,
      percentage: 0,
    });
  });

  it('returns sorted deficits by largest gap', () => {
    const deficits = getGovernanceDomainMaturityDeficits({
      threshold_results: [
        {
          threshold_key: 'reviewers',
          threshold_name: 'Reviewers',
          required_count: 4,
          observed_count: 2,
          meets_threshold: false,
          role_keys: ['reviewer'],
        },
        {
          threshold_key: 'stewards',
          threshold_name: 'Stewards',
          required_count: 8,
          observed_count: 3,
          meets_threshold: false,
          role_keys: ['steward'],
        },
      ],
    } as never);

    expect(deficits.map((item) => item.thresholdKey)).toEqual(['stewards', 'reviewers']);
  });

  it('derives maturity state from snapshot and transition context', () => {
    expect(getGovernanceDomainMaturityState({ snapshot: null })).toBe('unknown');
    expect(getGovernanceDomainMaturityState({ snapshot: { is_mature: true } as never })).toBe('mature');
    expect(
      getGovernanceDomainMaturityState({
        snapshot: { is_mature: false } as never,
        transition: { transition_type: 'regressed' } as never,
      }),
    ).toBe('at_risk');
    expect(getGovernanceDomainMaturityState({ snapshot: { is_mature: false } as never })).toBe('building');
  });
});
