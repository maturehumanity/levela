/**
 * Deterministic JSON helpers for verifier federation distribution packages.
 *
 * The database records `package_hash` as SHA-256 over Postgres `jsonb::text`
 * for the generated payload. That text format can differ from generic
 * `JSON.stringify` (key order, number formatting, etc.). The helpers here
 * produce a **sorted-key JSON** view so independent operators can agree on a
 * canonical interchange form; compare the preview to the server hash only
 * when you have confirmed the same serialization path end-to-end.
 */

export function stableSortJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => stableSortJsonValue(entry));
  }
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const next: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    next[key] = stableSortJsonValue(record[key]);
  }
  return next;
}

export function stableStringifyJson(value: unknown): string {
  return JSON.stringify(stableSortJsonValue(value));
}

export async function sha256HexFromUtf8(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function previewVerifierFederationPackagePayloadSha256Hex(
  packagePayload: Record<string, unknown>,
): Promise<string> {
  return sha256HexFromUtf8(stableStringifyJson(packagePayload));
}
