import { describe, expect, it } from 'vitest';

import {
  hashActivationDemographicPayload,
  verifyActivationDemographicPayloadSignature,
} from '@/lib/governance-activation-demographic-signing';

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('governance-activation-demographic-signing', () => {
  it('hashes signed payload deterministically', async () => {
    const payload = '{"scope":"world","target_population":1000}';
    const digest = await hashActivationDemographicPayload(payload);
    expect(typeof digest).toBe('string');
    expect(digest.length).toBeGreaterThan(20);
    await expect(hashActivationDemographicPayload(payload)).resolves.toBe(digest);
  });

  it('verifies signed demographic payloads with P-256 signer keys', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );

    const payload = '{"scope":"world","target_population":1000}';
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(payload),
    );
    const exportedPublicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);

    const verified = await verifyActivationDemographicPayloadSignature({
      keyAlgorithm: 'ECDSA_P256_SHA256_V1',
      signerPublicKey: toBase64Url(new Uint8Array(exportedPublicKey)),
      signedPayload: payload,
      signature: toBase64Url(new Uint8Array(signature)),
    });

    expect(verified).toBe(true);
  });

  it('returns false when the signed payload bytes do not match', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode('original-json'),
    );
    const exportedPublicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);

    const verified = await verifyActivationDemographicPayloadSignature({
      keyAlgorithm: 'ECDSA_P256_SHA256_V1',
      signerPublicKey: toBase64Url(new Uint8Array(exportedPublicKey)),
      signedPayload: 'tampered-json',
      signature: toBase64Url(new Uint8Array(signature)),
    });

    expect(verified).toBe(false);
  });

  it('rejects unsupported signer algorithms', async () => {
    await expect(
      verifyActivationDemographicPayloadSignature({
        keyAlgorithm: 'RSA_PKCS1',
        signerPublicKey: 'abc',
        signedPayload: '{}',
        signature: 'sig',
      }),
    ).rejects.toThrow('Unsupported external guardian key algorithm');
  });
});
