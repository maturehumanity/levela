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

  it('dedupes within the incoming page when starting from an empty list', () => {
    const incoming = [{ id: 'x', n: 1 }, { id: 'x', n: 2 }, { id: 'y', n: 3 }];
    expect(appendUniqueById([], incoming)).toEqual([{ id: 'x', n: 1 }, { id: 'y', n: 3 }]);
  });
});
