const GOVERNANCE_INTENT_VERSION = 'levela-governance-intent-v1';
const CITIZEN_SIGNING_KEY_STORAGE_PREFIX = 'levela:citizen-signing-key:v1';

export const CITIZEN_SIGNING_ALGORITHM = 'ECDSA_P256_SHA256_V1' as const;

export type CitizenSigningAlgorithm = typeof CITIZEN_SIGNING_ALGORITHM;

export type StoredCitizenSigningKey = {
  algorithm: CitizenSigningAlgorithm;
  publicKey: string;
  privateKey: string;
  createdAt: string;
};

export type GovernanceIntentInput = {
  actorProfileId: string;
  actionScope: string;
  payload: Record<string, unknown>;
  targetId?: string | null;
  clientCreatedAt?: string;
};

export type GovernanceIntentEnvelope = GovernanceIntentInput & {
  algorithm: CitizenSigningAlgorithm;
  publicKey: string;
  payloadHash: string;
  signature: string;
  clientCreatedAt: string;
};

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

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
}

function getSigningStorageKey(profileId: string) {
  return `${CITIZEN_SIGNING_KEY_STORAGE_PREFIX}:${profileId}`;
}

async function exportPublicKey(publicKey: CryptoKey) {
  const cryptoRef = getCryptoOrThrow();
  const exported = await cryptoRef.subtle.exportKey('spki', publicKey);
  return toBase64Url(new Uint8Array(exported));
}

async function exportPrivateKey(privateKey: CryptoKey) {
  const cryptoRef = getCryptoOrThrow();
  const exported = await cryptoRef.subtle.exportKey('pkcs8', privateKey);
  return toBase64Url(new Uint8Array(exported));
}

async function importPublicKey(publicKey: string) {
  const cryptoRef = getCryptoOrThrow();
  return cryptoRef.subtle.importKey(
    'spki',
    fromBase64Url(publicKey),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify'],
  );
}

async function importPrivateKey(privateKey: string) {
  const cryptoRef = getCryptoOrThrow();
  return cryptoRef.subtle.importKey(
    'pkcs8',
    fromBase64Url(privateKey),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign'],
  );
}

export async function generateCitizenSigningKey() {
  const cryptoRef = getCryptoOrThrow();
  const createdAt = new Date().toISOString();
  const keyPair = await cryptoRef.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify'],
  );

  const publicKey = await exportPublicKey(keyPair.publicKey);
  const privateKey = await exportPrivateKey(keyPair.privateKey);

  return {
    algorithm: CITIZEN_SIGNING_ALGORITHM,
    publicKey,
    privateKey,
    createdAt,
  } satisfies StoredCitizenSigningKey;
}

export function readStoredCitizenSigningKey(profileId: string): StoredCitizenSigningKey | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getSigningStorageKey(profileId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredCitizenSigningKey>;
    if (
      parsed.algorithm !== CITIZEN_SIGNING_ALGORITHM
      || typeof parsed.publicKey !== 'string'
      || typeof parsed.privateKey !== 'string'
      || typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }

    return parsed as StoredCitizenSigningKey;
  } catch {
    return null;
  }
}

export function storeCitizenSigningKey(profileId: string, value: StoredCitizenSigningKey) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getSigningStorageKey(profileId), JSON.stringify(value));
}

export function clearStoredCitizenSigningKey(profileId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getSigningStorageKey(profileId));
}

export function formatCitizenSigningFingerprint(publicKey: string | null | undefined) {
  if (!publicKey) return null;
  if (publicKey.length <= 24) return publicKey;
  return `${publicKey.slice(0, 12)}...${publicKey.slice(-12)}`;
}

function buildIntentSigningMessage(input: GovernanceIntentInput) {
  return stableStringify({
    version: GOVERNANCE_INTENT_VERSION,
    actorProfileId: input.actorProfileId,
    actionScope: input.actionScope,
    targetId: input.targetId ?? null,
    clientCreatedAt: input.clientCreatedAt,
    payload: input.payload,
  });
}

export async function hashGovernanceIntent(input: GovernanceIntentInput) {
  const cryptoRef = getCryptoOrThrow();
  const message = buildIntentSigningMessage(input);
  const digest = await cryptoRef.subtle.digest('SHA-256', encodeText(message));
  return toBase64Url(new Uint8Array(digest));
}

export async function signGovernanceIntent(
  input: GovernanceIntentInput,
  signingKey: StoredCitizenSigningKey,
): Promise<GovernanceIntentEnvelope> {
  const cryptoRef = getCryptoOrThrow();
  const clientCreatedAt = input.clientCreatedAt ?? new Date().toISOString();
  const normalizedInput = {
    ...input,
    clientCreatedAt,
  };
  const privateKey = await importPrivateKey(signingKey.privateKey);
  const message = buildIntentSigningMessage(normalizedInput);
  const signature = await cryptoRef.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    privateKey,
    encodeText(message),
  );

  return {
    ...normalizedInput,
    algorithm: signingKey.algorithm,
    publicKey: signingKey.publicKey,
    payloadHash: await hashGovernanceIntent(normalizedInput),
    signature: toBase64Url(new Uint8Array(signature)),
  };
}

export async function verifyGovernanceIntentSignature(intent: GovernanceIntentEnvelope) {
  const cryptoRef = getCryptoOrThrow();
  const publicKey = await importPublicKey(intent.publicKey);
  const message = buildIntentSigningMessage(intent);
  return cryptoRef.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    publicKey,
    fromBase64Url(intent.signature),
    encodeText(message),
  );
}
