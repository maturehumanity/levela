import {
  getGovernanceDomainMaturityDeficits,
  getGovernanceDomainMaturityProgress,
  getGovernanceDomainMaturityState,
  getGovernanceDomainTransitionSummary,
  parseGovernanceDomainThresholdResults,
} from '@/lib/governance-maturity';

describe('governance-maturity helpers', () => {
  it('returns an empty list when threshold results are not an array', () => {
    expect(parseGovernanceDomainThresholdResults(null)).toEqual([]);
    expect(parseGovernanceDomainThresholdResults({} as never)).toEqual([]);
  });

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

  it('floors numeric counts and drops blank or non-string role_keys', () => {
    expect(
      parseGovernanceDomainThresholdResults([
        {
          threshold_key: 'k1',
          threshold_name: 'N1',
          required_count: 2.9,
          observed_count: 1.1,
          meets_threshold: true,
          role_keys: [' ok ', '', 42, 'steward'],
        },
      ] as never),
    ).toEqual([
      {
        thresholdKey: 'k1',
        thresholdName: 'N1',
        requiredCount: 2,
        observedCount: 1,
        meetsThreshold: true,
        roleKeys: [' ok ', 'steward'],
      },
    ]);
  });

  it('drops entries with invalid counts or booleans', () => {
    expect(
      parseGovernanceDomainThresholdResults([
        {
          threshold_key: 'bad',
          threshold_name: 'Bad',
          required_count: -1,
          observed_count: 0,
          meets_threshold: true,
        },
        {
          threshold_key: 'bad2',
          threshold_name: 'Bad2',
          required_count: 1,
          observed_count: Number.NaN,
          meets_threshold: true,
        },
      ] as never),
    ).toEqual([]);
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

    expect(getGovernanceDomainMaturityProgress({ threshold_count: 0, thresholds_met_count: 0 })).toEqual({
      thresholdCount: 0,
      thresholdsMetCount: 0,
      percentage: 0,
    });

    expect(getGovernanceDomainMaturityProgress({ threshold_count: 4, thresholds_met_count: 10 })).toEqual({
      thresholdCount: 4,
      thresholdsMetCount: 4,
      percentage: 100,
    });
  });

  it('parses threshold results with empty role keys', () => {
    expect(
      parseGovernanceDomainThresholdResults([
        {
          threshold_key: 'solo',
          threshold_name: 'Solo',
          required_count: 1,
          observed_count: 1,
          meets_threshold: true,
          role_keys: [],
        },
      ] as never),
    ).toEqual([
      {
        thresholdKey: 'solo',
        thresholdName: 'Solo',
        requiredCount: 1,
        observedCount: 1,
        meetsThreshold: true,
        roleKeys: [],
      },
    ]);
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

  it('returns no deficits when snapshot threshold results are empty or missing', () => {
    expect(getGovernanceDomainMaturityDeficits(undefined)).toEqual([]);
    expect(getGovernanceDomainMaturityDeficits({ threshold_results: [] } as never)).toEqual([]);
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

  it('summarizes maturity transition types for steward copy', () => {
    expect(getGovernanceDomainTransitionSummary('matured')).toBe('Matured');
    expect(getGovernanceDomainTransitionSummary('regressed')).toBe('Regressed');
    expect(getGovernanceDomainTransitionSummary('unchanged')).toBe('No change');
    expect(getGovernanceDomainTransitionSummary('initial')).toBe('Initial snapshot');
    expect(getGovernanceDomainTransitionSummary('custom' as never)).toBe('custom');
  });
});
