import { describe, expect, it } from 'vitest';

import {
  hashExternalSignedMessage,
  verifyExternalGuardianSignature,
} from '@/lib/governance-external-signing';

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const encoded = btoa(binary);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

describe('governance-external-signing', () => {
  it('hashes external signed messages', async () => {
    const digest = await hashExternalSignedMessage('guardian-message');
    expect(typeof digest).toBe('string');
    expect(digest.length).toBeGreaterThan(20);
    await expect(hashExternalSignedMessage('guardian-message')).resolves.toBe(digest);
  });

  it('verifies P-256 guardian signatures', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify'],
    );

    const message = 'Proposal guardian approval for batch 4';
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      keyPair.privateKey,
      new TextEncoder().encode(message),
    );

    const exportedKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const verified = await verifyExternalGuardianSignature({
      keyAlgorithm: 'ECDSA_P256_SHA256_V1',
      signerPublicKey: toBase64Url(new Uint8Array(exportedKey)),
      signedMessage: message,
      signature: toBase64Url(new Uint8Array(signature)),
    });

    expect(verified).toBe(true);
  });

  it('accepts the legacy P-256 algorithm label without the _V1 suffix', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const message = 'Legacy label guardian payload';
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode(message),
    );
    const exportedKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    await expect(
      verifyExternalGuardianSignature({
        keyAlgorithm: '  ecdsa_p256_sha256  ',
        signerPublicKey: toBase64Url(new Uint8Array(exportedKey)),
        signedMessage: message,
        signature: toBase64Url(new Uint8Array(signature)),
      }),
    ).resolves.toBe(true);
  });

  it('returns false when the signed bytes do not match', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      new TextEncoder().encode('original bytes'),
    );
    const exportedKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    await expect(
      verifyExternalGuardianSignature({
        keyAlgorithm: 'ECDSA_P256_SHA256_V1',
        signerPublicKey: toBase64Url(new Uint8Array(exportedKey)),
        signedMessage: 'different bytes',
        signature: toBase64Url(new Uint8Array(signature)),
      }),
    ).resolves.toBe(false);
  });

  it('rejects unsupported algorithms', async () => {
    await expect(
      verifyExternalGuardianSignature({
        keyAlgorithm: 'RSA_SHA256',
        signerPublicKey: 'abc',
        signedMessage: 'x',
        signature: 'y',
      }),
    ).rejects.toThrow('Unsupported external guardian key algorithm');
  });
});
