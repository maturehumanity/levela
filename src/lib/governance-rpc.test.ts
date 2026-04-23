import { describe, expect, it } from 'vitest';

import { asIntegerOrNull, asNumericOrNull } from '@/lib/governance-rpc';

describe('asIntegerOrNull', () => {
  it('parses positive integers', () => {
    expect(asIntegerOrNull('42')).toBe(42);
    expect(asIntegerOrNull('0')).toBe(0);
  });

  it('returns null for empty or non-finite input', () => {
    expect(asIntegerOrNull('')).toBeNull();
    expect(asIntegerOrNull('  ')).toBeNull();
    expect(asIntegerOrNull('not-a-number')).toBeNull();
  });

  it('uses parseInt prefix rules (fractional strings truncate)', () => {
    expect(asIntegerOrNull('12.5')).toBe(12);
  });
});

describe('asNumericOrNull', () => {
  it('parses decimals', () => {
    expect(asNumericOrNull('3.14')).toBeCloseTo(3.14);
    expect(asNumericOrNull('-2')).toBe(-2);
  });

  it('returns null for empty or non-finite input', () => {
    expect(asNumericOrNull('')).toBeNull();
    expect(asNumericOrNull('x')).toBeNull();
  });
});
