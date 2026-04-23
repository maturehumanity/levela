import { describe, expect, it } from 'vitest';

import { appendUniqueById } from '@/lib/governance-activation-demographic-feed-pagination';

describe('appendUniqueById', () => {
  it('returns the same array reference when incoming is empty', () => {
    const existing = [{ id: 'a' }];
    expect(appendUniqueById(existing, [])).toBe(existing);
  });

  it('appends only unseen ids and preserves order', () => {
    const existing = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'b' }, { id: 'c' }, { id: 'a' }];
    expect(appendUniqueById(existing, incoming)).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });
});
