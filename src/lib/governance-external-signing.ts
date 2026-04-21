function getCryptoOrThrow() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto is not available in this environment.');
  }

  return crypto;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const encoded = btoa(binary);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

export async function hashExternalSignedMessage(message: string) {
  const cryptoRef = getCryptoOrThrow();
  const digest = await cryptoRef.subtle.digest('SHA-256', encodeText(message));
  return toBase64Url(new Uint8Array(digest));
}

function isP256Algorithm(keyAlgorithm: string) {
  const normalized = keyAlgorithm.trim().toUpperCase();
  return normalized === 'ECDSA_P256_SHA256_V1' || normalized === 'ECDSA_P256_SHA256';
}

async function verifyP256Signature(args: {
  signerPublicKey: string;
  signedMessage: string;
  signature: string;
}) {
  const cryptoRef = getCryptoOrThrow();

  const importedKey = await cryptoRef.subtle.importKey(
    'spki',
    fromBase64Url(args.signerPublicKey.trim()),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify'],
  );

  return cryptoRef.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    importedKey,
    fromBase64Url(args.signature.trim()),
    encodeText(args.signedMessage),
  );
}

export async function verifyExternalGuardianSignature(args: {
  keyAlgorithm: string;
  signerPublicKey: string;
  signedMessage: string;
  signature: string;
}) {
  if (isP256Algorithm(args.keyAlgorithm)) {
    return verifyP256Signature(args);
  }

  throw new Error(`Unsupported external guardian key algorithm: ${args.keyAlgorithm}`);
}
