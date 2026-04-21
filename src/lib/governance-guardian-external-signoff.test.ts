import { describe, expect, it } from 'vitest';

import { prepareExternalGuardianSignoffPayload } from '@/lib/governance-guardian-external-signoff';
import type { GuardianExternalSignerRow } from '@/lib/governance-guardian-multisig';

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createSignerRow(): Promise<GuardianExternalSignerRow> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify'],
  );
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    activated_at: new Date().toISOString(),
    added_by: null,
    created_at: new Date().toISOString(),
    custody_provider: null,
    deactivated_at: null,
    id: 'signer-id',
    is_active: true,
    key_algorithm: 'ECDSA_P256_SHA256_V1',
    metadata: {},
    signer_key: toBase64Url(new Uint8Array(spki)),
    signer_label: 'Test signer',
    updated_at: new Date().toISOString(),
  };
}

describe('governance-guardian-external-signoff', () => {
  it('falls back to attestation when no cryptographic payload is provided', async () => {
    const signer = await createSignerRow();
    const prepared = await prepareExternalGuardianSignoffPayload({
      signer,
      payloadHashInput: '',
      signedMessageInput: '',
      signatureInput: '',
    });

    expect(prepared.verificationMethod).toBe('guardian_multisig_attestation');
    expect(prepared.payloadHash).toBe(null);
    expect(prepared.signedMessage).toBe(null);
    expect(prepared.signature).toBe(null);
    expect(prepared.hasCryptographicPayload).toBe(false);
  });

  it('verifies cryptographic payload and derives payload hash', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify'],
    );
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const signer: GuardianExternalSignerRow = {
      activated_at: new Date().toISOString(),
      added_by: null,
      created_at: new Date().toISOString(),
      custody_provider: null,
      deactivated_at: null,
      id: 'signer-id',
      is_active: true,
      key_algorithm: 'ECDSA_P256_SHA256_V1',
      metadata: {},
      signer_key: toBase64Url(new Uint8Array(spki)),
      signer_label: 'Test signer',
      updated_at: new Date().toISOString(),
    };

    const message = 'proposal:abc|decision:approve';
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      keyPair.privateKey,
      new TextEncoder().encode(message),
    );

    const prepared = await prepareExternalGuardianSignoffPayload({
      signer,
      payloadHashInput: '',
      signedMessageInput: message,
      signatureInput: toBase64Url(new Uint8Array(signature)),
    });

    expect(prepared.verificationMethod).toBe('cryptographic_signature_verification');
    expect(prepared.hasCryptographicPayload).toBe(true);
    expect(prepared.signedMessage).toBe(message);
    expect(prepared.signature).toBeTruthy();
    expect(prepared.payloadHash).toBeTruthy();
  });

  it('rejects mismatched cryptographic payload fields', async () => {
    const signer = await createSignerRow();
    await expect(
      prepareExternalGuardianSignoffPayload({
        signer,
        payloadHashInput: '',
        signedMessageInput: 'x',
        signatureInput: '',
      }),
    ).rejects.toThrow('Signed message and signature must both be provided');
  });
});
