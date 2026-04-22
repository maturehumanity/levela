import { describe, expect, it } from 'vitest';

import {
  previewVerifierFederationPackagePayloadSha256Hex,
  sha256HexFromUtf8,
  stableStringifyJson,
} from '@/lib/verifier-federation-deterministic-json';

describe('verifier-federation-deterministic-json', () => {
  it('stringifies objects with sorted keys', () => {
    expect(stableStringifyJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringifyJson({ z: { m: 1, a: 2 } })).toBe('{"z":{"a":2,"m":1}}');
  });

  it('matches known SHA-256 for empty object JSON', async () => {
    const hex = await sha256HexFromUtf8('{}');
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    const preview = await previewVerifierFederationPackagePayloadSha256Hex({});
    expect(preview).toBe(hex);
  });
});
