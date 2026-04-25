import type { SupabaseClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';

import type { Database } from '@/integrations/supabase/types';

const DB_NAME = 'levela-messaging-e2ee';
const DB_VERSION = 1;
const STORE = 'keys';

type KeyRecord = { profileId: string; secretKey: ArrayBuffer };

function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'profileId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function getDeviceMessagingSecretKey(profileId: string): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const getReq = tx.objectStore(STORE).get(profileId);
    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const row = getReq.result as KeyRecord | undefined;
      if (!row?.secretKey) {
        resolve(null);
        return;
      }
      resolve(new Uint8Array(row.secretKey));
    };
  });
}

export async function saveDeviceMessagingSecretKey(profileId: string, secretKey: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
  const db = await openDb();
  const copy = secretKey.slice();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    tx.objectStore(STORE).put({
      profileId,
      secretKey: copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
    } satisfies KeyRecord);
  });
}

export async function clearDeviceMessagingSecretKey(profileId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
    tx.objectStore(STORE).delete(profileId);
  });
}

export function generateMessagingKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.box.keyPair();
}

export function publicKeyBase64FromSecretKey(secretKey: Uint8Array): string {
  const kp = nacl.box.keyPair.fromSecretKey(secretKey);
  return encodePublicKeyBase64(kp.publicKey);
}

/**
 * For accounts that can use private messaging: ensure a device keypair exists and the
 * server has the matching public key (default-on E2EE advertisement).
 */
export async function ensureDefaultMessagingEncryption(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  const local = await getDeviceMessagingSecretKey(profileId);
  const { data: row, error } = await supabase
    .from('profiles')
    .select('messaging_x25519_public_key')
    .eq('id', profileId)
    .single();

  if (error) return;

  const serverB64 = (row?.messaging_x25519_public_key as string | null | undefined) ?? null;

  if (local && local.length === nacl.box.secretKeyLength) {
    const pubB64 = publicKeyBase64FromSecretKey(local);
    if (serverB64 !== pubB64) {
      await supabase.from('profiles').update({ messaging_x25519_public_key: pubB64 }).eq('id', profileId);
    }
    return;
  }

  if (!serverB64) {
    const pair = generateMessagingKeyPair();
    await saveDeviceMessagingSecretKey(profileId, pair.secretKey);
    const pubB64 = encodePublicKeyBase64(pair.publicKey);
    await supabase.from('profiles').update({ messaging_x25519_public_key: pubB64 }).eq('id', profileId);
  }
}

export function encodePublicKeyBase64(publicKey: Uint8Array): string {
  return bytesToBase64(publicKey);
}

export function decodePublicKeyBase64(value: string): Uint8Array | null {
  const raw = base64ToBytes(value.trim());
  if (!raw || raw.length !== nacl.box.publicKeyLength) return null;
  return raw;
}

export function buildSharedEncryptionKey(mySecretKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  return nacl.box.before(theirPublicKey, mySecretKey);
}

export function encryptUtf8Plaintext(plaintext: string, sharedKey: Uint8Array): { nonceB64: string; cipherB64: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msg = utf8ToBytes(plaintext);
  const cipher = nacl.secretbox(msg, nonce, sharedKey);
  return { nonceB64: bytesToBase64(nonce), cipherB64: bytesToBase64(cipher) };
}

export function decryptUtf8Plaintext(nonceB64: string, cipherB64: string, sharedKey: Uint8Array): string | null {
  const nonce = base64ToBytes(nonceB64);
  const cipher = base64ToBytes(cipherB64);
  if (!nonce || !cipher) return null;
  const opened = nacl.secretbox.open(cipher, nonce, sharedKey);
  if (!opened) return null;
  return bytesToUtf8(opened);
}
