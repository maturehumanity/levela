import type {
  GovernanceProposalGuardianRelayClientVerificationDistributionSummary,
  GovernanceProposalGuardianRelayClientVerificationPackage,
  GovernanceProposalGuardianRelayClientVerificationSignatureRow,
  GovernanceProposalGuardianRelayRecentClientVerificationPackageRow,
} from '@/lib/governance-guardian-relays.types';

function asNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
}

function asNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readGovernanceProposalGuardianRelayClientVerificationPackage(
  rows: unknown,
): GovernanceProposalGuardianRelayClientVerificationPackage | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const packageVersion = asString(row.package_version);
  const packageHash = asString(row.package_hash);
  const packagePayload = asRecord(row.package_payload);
  const sourceManifestId = asString(row.source_manifest_id);
  const sourceManifestHash = asString(row.source_manifest_hash);

  if (!packageVersion || !packageHash || !packagePayload || !sourceManifestId || !sourceManifestHash) return null;

  return {
    packageVersion,
    packageHash,
    packagePayload,
    sourceManifestId,
    sourceManifestHash,
    trustMinimizedQuorumMet: Boolean(row.trust_minimized_quorum_met),
    relayOpsReady: Boolean(row.relay_ops_ready),
  };
}

export function readGovernanceProposalGuardianRelayRecentClientVerificationPackageRows(
  rows: unknown,
): GovernanceProposalGuardianRelayRecentClientVerificationPackageRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      packageId: asString(entry.package_id),
      capturedAt: asString(entry.captured_at),
      packageVersion: asString(entry.package_version),
      packageHash: asString(entry.package_hash),
      sourceManifestHash: asString(entry.source_manifest_hash),
      signatureCount: asNonNegativeInteger(entry.signature_count),
      distributionReady: Boolean(entry.distribution_ready),
      packageNotes: asNullableString(entry.package_notes),
    }))
    .filter((entry) => entry.packageId.length > 0 && entry.capturedAt.length > 0);
}

export function readGovernanceProposalGuardianRelayClientVerificationDistributionSummary(
  rows: unknown,
): GovernanceProposalGuardianRelayClientVerificationDistributionSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const packageId = asString(row.package_id);
  const capturedAt = asString(row.captured_at);
  const packageVersion = asString(row.package_version);
  const packageHash = asString(row.package_hash);
  const sourceManifestHash = asString(row.source_manifest_hash);
  if (!packageId || !capturedAt || !packageVersion || !packageHash || !sourceManifestHash) return null;

  return {
    packageId,
    capturedAt,
    packageVersion,
    packageHash,
    sourceManifestHash,
    requiredDistributionSignatures: Math.max(1, asNonNegativeInteger(row.required_distribution_signatures, 1)),
    signatureCount: asNonNegativeInteger(row.signature_count),
    distinctSignerCount: asNonNegativeInteger(row.distinct_signer_count),
    distinctSignerJurisdictionsCount: asNonNegativeInteger(row.distinct_signer_jurisdictions_count),
    distinctSignerTrustDomainsCount: asNonNegativeInteger(row.distinct_signer_trust_domains_count),
    lastSignedAt: asNullableString(row.last_signed_at),
    distributionReady: Boolean(row.distribution_ready),
  };
}

export function readGovernanceProposalGuardianRelayClientVerificationSignatureRows(
  rows: unknown,
): GovernanceProposalGuardianRelayClientVerificationSignatureRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      signatureId: asString(entry.signature_id),
      packageId: asString(entry.package_id),
      packageHash: asString(entry.package_hash),
      signerKey: asString(entry.signer_key),
      signatureAlgorithm: asString(entry.signature_algorithm, 'unknown'),
      distributionChannel: asString(entry.distribution_channel, 'primary'),
      signerTrustDomain: asString(entry.signer_trust_domain, 'public'),
      signerJurisdictionCountryCode: asNullableString(entry.signer_jurisdiction_country_code),
      signedAt: asNullableString(entry.signed_at),
    }))
    .filter((entry) => entry.signatureId.length > 0 && entry.packageId.length > 0 && entry.signerKey.length > 0);
}
