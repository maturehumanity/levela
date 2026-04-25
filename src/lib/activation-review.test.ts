import { describe, expect, it } from 'vitest';

import { isActivationScopeDeclared } from '@/lib/activation-review';

describe('activation review helpers', () => {
  it('treats null and undefined reviews as not declared', () => {
    expect(isActivationScopeDeclared(null)).toBe(false);
    expect(isActivationScopeDeclared(undefined)).toBe(false);
  });

  it('treats only activated reviews with declaration timestamps as declared', () => {
    expect(
      isActivationScopeDeclared({
        status: 'activated',
        declared_at: '2026-04-20T00:00:00.000Z',
      }),
    ).toBe(true);

    expect(
      isActivationScopeDeclared({
        status: 'approved_for_activation',
        declared_at: '2026-04-20T00:00:00.000Z',
      }),
    ).toBe(false);

    expect(
      isActivationScopeDeclared({
        status: 'activated',
        declared_at: null,
      }),
    ).toBe(false);
  });
});
