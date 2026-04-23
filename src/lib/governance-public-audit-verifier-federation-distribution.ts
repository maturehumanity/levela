import type {
  GovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  GovernancePublicAuditVerifierFederationPackage,
  GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  GovernancePublicAuditVerifierFederationPackageHistoryRow,
  GovernancePublicAuditVerifierFederationPackageSignatureRow,
  GovernancePublicAuditVerifierFederationRecentPackageRow,
} from '@/lib/governance-public-audit-verifier-federation.types';

export type {
  GovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  GovernancePublicAuditVerifierFederationPackage,
  GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  GovernancePublicAuditVerifierFederationPackageHistoryRow,
  GovernancePublicAuditVerifierFederationPackageSignatureRow,
  GovernancePublicAuditVerifierFederationRecentPackageRow,
} from '@/lib/governance-public-audit-verifier-federation.types';

function asString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value;
}

function asNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'f' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readGovernancePublicAuditVerifierFederationPackage(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackage | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const packageVersion = asString(row.package_version);
  const packageHash = asString(row.package_hash);
  const packagePayload = asRecord(row.package_payload);
  const batchId = asString(row.batch_id);
  const sourceDirectoryId = asString(row.source_directory_id);
  const sourceDirectoryHash = asString(row.source_directory_hash);

  if (!packageVersion || !packageHash || !packagePayload || !batchId || !sourceDirectoryId || !sourceDirectoryHash) {
    return null;
  }

  return {
    packageVersion,
    packageHash,
    packagePayload,
    batchId,
    sourceDirectoryId,
    sourceDirectoryHash,
    federationOpsReady: asBoolean(row.federation_ops_ready, false),
    digestSourceText: asNullableString(row.digest_source_text),
  };
}

export function readGovernancePublicAuditVerifierFederationPackageHistoryRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackageHistoryRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      packageId: asString(entry.package_id),
      batchId: asString(entry.batch_id),
      capturedAt: asString(entry.captured_at),
      packageVersion: asString(entry.package_version),
      packageHash: asString(entry.package_hash),
      sourceDirectoryId: asString(entry.source_directory_id),
      signatureCount: asNonNegativeInteger(entry.signature_count),
    }))
    .filter((entry) => entry.packageId.length > 0 && entry.batchId.length > 0 && entry.capturedAt.length > 0);
}

export function readGovernancePublicAuditVerifierFederationRecentPackageRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationRecentPackageRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const metadata = asRecord(entry.metadata);

      return {
        packageId: asString(entry.id),
        batchId: asString(entry.batch_id),
        capturedAt: asString(entry.captured_at),
        packageVersion: asString(entry.package_version),
        packageHash: asString(entry.package_hash),
        sourceDirectoryId: asString(entry.source_directory_id),
        sourceDirectoryHash: asString(entry.source_directory_hash),
        signatureCount: asNonNegativeInteger(entry.signature_count),
        distributionReady: asBoolean(entry.distribution_ready, false),
        packageNotes: asNullableString(metadata?.notes),
      };
    })
    .filter((entry) => entry.packageId.length > 0 && entry.batchId.length > 0 && entry.capturedAt.length > 0);
}

export function readGovernancePublicAuditVerifierFederationPackageDistributionSummary(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackageDistributionSummary | null {
  const snapshot = readGovernancePublicAuditVerifierFederationDistributionGateSnapshot(rows);
  if (!snapshot || !snapshot.hasCapturedPackage) return null;

  return {
    packageId: snapshot.packageId as string,
    batchId: snapshot.batchId as string,
    capturedAt: snapshot.capturedAt as string,
    packageVersion: snapshot.packageVersion,
    packageHash: snapshot.packageHash,
    sourceDirectoryHash: snapshot.sourceDirectoryHash,
    requiredDistributionSignatures: snapshot.requiredDistributionSignatures,
    signatureCount: snapshot.signatureCount,
    distinctSignerCount: snapshot.distinctSignerCount,
    distinctSignerJurisdictionsCount: snapshot.distinctSignerJurisdictionsCount,
    distinctSignerTrustDomainsCount: snapshot.distinctSignerTrustDomainsCount,
    lastSignedAt: snapshot.lastSignedAt,
    federationOpsReady: snapshot.federationOpsReady,
    distributionReady: snapshot.distributionReady,
  };
}

export function readGovernancePublicAuditVerifierFederationDistributionGateSnapshot(
  rows: unknown,
): GovernancePublicAuditVerifierFederationDistributionGateSnapshot | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const packageIdRaw = asString(row.package_id);
  const batchIdRaw = asString(row.batch_id);
  const capturedAtRaw = asString(row.captured_at);
  const packageVersion = asString(row.package_version);
  const packageHash = asString(row.package_hash);
  const sourceDirectoryHash = asString(row.source_directory_hash);
  const hasCapturedPackage =
    packageIdRaw.length > 0
    && batchIdRaw.length > 0
    && capturedAtRaw.length > 0
    && packageVersion.length > 0
    && packageHash.length > 0
    && sourceDirectoryHash.length > 0;

  return {
    hasCapturedPackage,
    packageId: hasCapturedPackage ? packageIdRaw : null,
    batchId: hasCapturedPackage ? batchIdRaw : null,
    capturedAt: hasCapturedPackage ? capturedAtRaw : null,
    packageVersion,
    packageHash,
    sourceDirectoryHash,
    requiredDistributionSignatures: Math.max(1, asNonNegativeInteger(row.required_distribution_signatures, 1)),
    signatureCount: asNonNegativeInteger(row.signature_count),
    distinctSignerCount: asNonNegativeInteger(row.distinct_signer_count),
    distinctSignerJurisdictionsCount: asNonNegativeInteger(row.distinct_signer_jurisdictions_count),
    distinctSignerTrustDomainsCount: asNonNegativeInteger(row.distinct_signer_trust_domains_count),
    lastSignedAt: asNullableString(row.last_signed_at),
    federationOpsReady: asBoolean(row.federation_ops_ready, false),
    distributionReady: asBoolean(row.distribution_ready, false),
  };
}

export function readGovernancePublicAuditVerifierFederationPackageSignatureRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackageSignatureRow[] {
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
