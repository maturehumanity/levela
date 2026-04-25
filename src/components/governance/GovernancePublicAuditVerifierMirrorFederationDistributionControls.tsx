import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GovernancePublicAuditExternalExecutionPageBoardRow } from '@/lib/governance-public-audit-automation';
import type {
  GovernancePublicAuditVerifierFederationExchangeAttestationRow,
  GovernancePublicAuditVerifierFederationExchangeAttestationSummary,
  GovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus,
  GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary,
  GovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  GovernancePublicAuditVerifierFederationPackage,
  GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  GovernancePublicAuditVerifierFederationPackageHistoryRow,
  GovernancePublicAuditVerifierFederationPackageSignatureRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
} from '@/lib/governance-public-audit-verifiers';
import {
  formatGovernancePublicAuditVerifierFederationDistributionReadinessIssue,
  formatGovernancePublicAuditVerifierFederationOpsReadinessIssue,
  readGovernancePublicAuditVerifierFederationDistributionReadinessIssues,
  readGovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  readGovernancePublicAuditVerifierFederationOpsReadinessIssues,
} from '@/lib/governance-public-audit-verifiers';
import { previewVerifierFederationPackagePayloadSha256Hex, sha256HexFromUtf8 } from '@/lib/verifier-federation-deterministic-json';

interface GovernancePublicAuditVerifierMirrorFederationDistributionControlsProps {
  canManageMirrorFederation: boolean;
  federationPackage: GovernancePublicAuditVerifierFederationPackage | null;
  federationPackageDistributionSummary: GovernancePublicAuditVerifierFederationPackageDistributionSummary | null;
  federationPackageSignatures: GovernancePublicAuditVerifierFederationPackageSignatureRow[];
  federationPackageHistory: GovernancePublicAuditVerifierFederationPackageHistoryRow[];
  federationExchangeAttestationSummary: GovernancePublicAuditVerifierFederationExchangeAttestationSummary | null;
  federationExchangeAttestations: GovernancePublicAuditVerifierFederationExchangeAttestationRow[];
  federationExchangeReceiptPolicySummary: GovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary | null;
  federationExchangeReceiptAutomationStatus: GovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus | null;
  federationExchangeReceiptAutomationRuns: GovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRow[];
  federationExchangeReceiptEscalationHistory: GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow[];
  federationExchangeReceiptEscalationPages: GovernancePublicAuditExternalExecutionPageBoardRow[];
  federationExchangeReceiptPolicyEvents: GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow[];
  federationOperationsSummary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
  capturingFederationPackage: boolean;
  signingFederationPackage: boolean;
  verifyingFederationDistribution: boolean;
  recordingFederationExchangeAttestation: boolean;
  verifyingFederationExchangeReceipt: boolean;
  savingFederationExchangeReceiptPolicy: boolean;
  runningFederationExchangeReceiptAutomationCheck: boolean;
  acknowledgingFederationExchangeReceiptEscalationPageId: string | null;
  resolvingFederationExchangeReceiptEscalationPageId: string | null;
  rollingBackFederationExchangeReceiptPolicyEventId: string | null;
  captureFederationPackage: (packageNotes: string) => Promise<void> | void;
  signFederationPackage: (draft: {
    packageId: string;
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
    signerTrustDomain: string;
    signerJurisdictionCountryCode: string;
    signerIdentityUri: string;
    distributionChannel: string;
  }) => Promise<void> | void;
  runFederationDistributionVerification: (staleAfterHours: string) => Promise<void> | void;
  recordFederationExchangeAttestation: (draft: {
    packageId: string;
    operatorLabel: string;
    operatorIdentityUri: string;
    operatorTrustDomain: string;
    operatorJurisdictionCountryCode: string;
    exchangeChannel: string;
    attestationVerdict: string;
    attestationNotes: string;
    receiptPayloadText: string;
    receiptSignature: string;
    receiptSignerKey: string;
    receiptSignatureAlgorithm: string;
  }) => Promise<void> | void;
  verifyFederationExchangeReceipt: (draft: {
    attestationId: string;
    receiptVerified: boolean;
    receiptVerificationNotes: string;
  }) => Promise<void> | void;
  saveFederationExchangeReceiptPolicy: (draft: {
    lookbackHours: string;
    warningPendingThreshold: string;
    criticalPendingThreshold: string;
    escalationEnabled: boolean;
    oncallChannel: string;
    receiptMaxVerificationAgeHours: string;
    criticalStaleReceiptCountThreshold: string;
  }) => Promise<void> | void;
  runFederationExchangeReceiptAutomationCheck: (draft: {
    lookbackHours: string;
    runMessage: string;
  }) => Promise<void> | void;
  acknowledgeFederationExchangeReceiptEscalationPage: (pageId: string) => Promise<void> | void;
  resolveFederationExchangeReceiptEscalationPage: (pageId: string) => Promise<void> | void;
  rollbackFederationExchangeReceiptPolicyToEvent: (eventId: string) => Promise<void> | void;
  formatTimestamp: (value: string | null) => string;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function normalizeAutomationRunStatus(value: string | null) {
  return (value || '').trim().toLowerCase();
}

function describeReceiptAutomationHealth(args: {
  cronSchemaAvailable: boolean;
  cronJobRegistered: boolean;
  cronJobActive: boolean;
  latestCronRunStartedAt: string | null;
  latestCronRunStatus: string | null;
}) {
  const { cronSchemaAvailable, cronJobRegistered, cronJobActive, latestCronRunStartedAt, latestCronRunStatus } = args;
  const normalizedRunStatus = normalizeAutomationRunStatus(latestCronRunStatus);
  if (!cronSchemaAvailable) {
    return { label: 'pg_cron unavailable', healthy: false };
  }
  if (!cronJobRegistered) {
    return { label: 'Receipt cron not registered', healthy: false };
  }
  if (!cronJobActive) {
    return { label: 'Receipt cron paused', healthy: false };
  }
  if (!latestCronRunStartedAt) {
    return { label: 'No receipt cron run recorded', healthy: false };
  }
  if (normalizedRunStatus === 'failed' || normalizedRunStatus === 'failure') {
    return { label: 'Latest receipt cron run failed', healthy: false };
  }
  return { label: 'Receipt automation healthy', healthy: true };
}

export function GovernancePublicAuditVerifierMirrorFederationDistributionControls({
  canManageMirrorFederation,
  federationPackage,
  federationPackageDistributionSummary,
  federationPackageSignatures,
  federationPackageHistory,
  federationExchangeAttestationSummary,
  federationExchangeAttestations,
  federationExchangeReceiptPolicySummary,
  federationExchangeReceiptAutomationStatus,
  federationExchangeReceiptAutomationRuns,
  federationExchangeReceiptEscalationHistory,
  federationExchangeReceiptEscalationPages,
  federationExchangeReceiptPolicyEvents,
  federationOperationsSummary,
  capturingFederationPackage,
  signingFederationPackage,
  verifyingFederationDistribution,
  recordingFederationExchangeAttestation,
  verifyingFederationExchangeReceipt,
  savingFederationExchangeReceiptPolicy,
  runningFederationExchangeReceiptAutomationCheck,
  acknowledgingFederationExchangeReceiptEscalationPageId,
  resolvingFederationExchangeReceiptEscalationPageId,
  rollingBackFederationExchangeReceiptPolicyEventId,
  captureFederationPackage,
  signFederationPackage,
  runFederationDistributionVerification,
  recordFederationExchangeAttestation,
  verifyFederationExchangeReceipt,
  saveFederationExchangeReceiptPolicy,
  runFederationExchangeReceiptAutomationCheck,
  acknowledgeFederationExchangeReceiptEscalationPage,
  resolveFederationExchangeReceiptEscalationPage,
  rollbackFederationExchangeReceiptPolicyToEvent,
  formatTimestamp,
}: GovernancePublicAuditVerifierMirrorFederationDistributionControlsProps) {
  const [packageNotes, setPackageNotes] = useState('');
  const [staleAfterHours, setStaleAfterHours] = useState(
    federationOperationsSummary ? String(federationOperationsSummary.distributionVerificationLookbackHours) : '24',
  );
  const [signatureDraft, setSignatureDraft] = useState({
    signerKey: '',
    signature: '',
    signatureAlgorithm: 'ed25519',
    signerTrustDomain: 'public',
    signerJurisdictionCountryCode: '',
    signerIdentityUri: '',
    distributionChannel: 'primary',
  });
  const [hashPreviewLoading, setHashPreviewLoading] = useState(false);
  const [hashPreview, setHashPreview] = useState<{ hex: string; matches: boolean } | null>(null);
  const [serverDigestLoading, setServerDigestLoading] = useState(false);
  const [serverDigestPreview, setServerDigestPreview] = useState<{ hex: string; matches: boolean } | null>(null);
  const [exchangeAttestationDraft, setExchangeAttestationDraft] = useState({
    operatorLabel: '',
    operatorIdentityUri: '',
    operatorTrustDomain: 'external',
    operatorJurisdictionCountryCode: '',
    exchangeChannel: 'api',
    attestationVerdict: 'accepted',
    attestationNotes: '',
    receiptPayloadText: '',
    receiptSignature: '',
    receiptSignerKey: '',
    receiptSignatureAlgorithm: 'ed25519',
  });
  const [receiptPolicyDraft, setReceiptPolicyDraft] = useState({
    lookbackHours: '336',
    warningPendingThreshold: '1',
    criticalPendingThreshold: '5',
    escalationEnabled: true,
    oncallChannel: 'public_audit_ops',
    receiptMaxVerificationAgeHours: '72',
    criticalStaleReceiptCountThreshold: '3',
  });
  const [receiptAutomationRunDraft, setReceiptAutomationRunDraft] = useState({
    lookbackHours: '336',
    runMessage: '',
  });

  const signingTargetPackageId = useMemo(
    () => federationPackageDistributionSummary?.packageId || '',
    [federationPackageDistributionSummary?.packageId],
  );
  const distributionGateSnapshot = useMemo<GovernancePublicAuditVerifierFederationDistributionGateSnapshot | null>(
    () => {
      if (!federationPackageDistributionSummary) return null;
      return {
        hasCapturedPackage: true,
        packageId: federationPackageDistributionSummary.packageId,
        batchId: federationPackageDistributionSummary.batchId,
        capturedAt: federationPackageDistributionSummary.capturedAt,
        packageVersion: federationPackageDistributionSummary.packageVersion,
        packageHash: federationPackageDistributionSummary.packageHash,
        sourceDirectoryHash: federationPackageDistributionSummary.sourceDirectoryHash,
        requiredDistributionSignatures: federationPackageDistributionSummary.requiredDistributionSignatures,
        signatureCount: federationPackageDistributionSummary.signatureCount,
        distinctSignerCount: federationPackageDistributionSummary.distinctSignerCount,
        distinctSignerJurisdictionsCount: federationPackageDistributionSummary.distinctSignerJurisdictionsCount,
        distinctSignerTrustDomainsCount: federationPackageDistributionSummary.distinctSignerTrustDomainsCount,
        lastSignedAt: federationPackageDistributionSummary.lastSignedAt,
        federationOpsReady: federationPackageDistributionSummary.federationOpsReady,
        distributionReady: federationPackageDistributionSummary.distributionReady,
      };
    },
    [federationPackageDistributionSummary],
  );
  const distributionReadinessIssues = useMemo(
    () => readGovernancePublicAuditVerifierFederationDistributionReadinessIssues({
      snapshot: distributionGateSnapshot,
      federationOperationsSummary,
    }),
    [distributionGateSnapshot, federationOperationsSummary],
  );
  const opsReadinessIssues = useMemo(
    () => readGovernancePublicAuditVerifierFederationOpsReadinessIssues(federationOperationsSummary),
    [federationOperationsSummary],
  );
  const receiptAutomationHealth = useMemo(() => {
    if (!federationExchangeReceiptAutomationStatus) return null;
    return describeReceiptAutomationHealth({
      cronSchemaAvailable: federationExchangeReceiptAutomationStatus.cronSchemaAvailable,
      cronJobRegistered: federationExchangeReceiptAutomationStatus.cronJobRegistered,
      cronJobActive: federationExchangeReceiptAutomationStatus.cronJobActive,
      latestCronRunStartedAt: federationExchangeReceiptAutomationStatus.latestCronRunStartedAt,
      latestCronRunStatus: federationExchangeReceiptAutomationStatus.latestCronRunStatus,
    });
  }, [federationExchangeReceiptAutomationStatus]);
  const receiptEscalationHistoryAnalytics = useMemo(() => {
    const nowMs = Date.now();
    const lookback24hMs = 24 * 60 * 60 * 1000;
    let opened24h = 0;
    let resolved24h = 0;
    let unresolved = 0;
    const resolutionDurationsHours: number[] = [];

    federationExchangeReceiptEscalationHistory.forEach((row) => {
      const openedMs = row.openedAt ? Date.parse(row.openedAt) : Number.NaN;
      const resolvedMs = row.resolvedAt ? Date.parse(row.resolvedAt) : Number.NaN;
      if (Number.isFinite(openedMs) && nowMs - openedMs <= lookback24hMs) opened24h += 1;
      if (Number.isFinite(resolvedMs) && nowMs - resolvedMs <= lookback24hMs) resolved24h += 1;
      if (row.pageStatus !== 'resolved') unresolved += 1;
      if (Number.isFinite(openedMs) && Number.isFinite(resolvedMs) && resolvedMs >= openedMs) {
        resolutionDurationsHours.push((resolvedMs - openedMs) / (60 * 60 * 1000));
      }
    });

    const averageResolutionHours = resolutionDurationsHours.length
      ? resolutionDurationsHours.reduce((sum, value) => sum + value, 0) / resolutionDurationsHours.length
      : null;

    return {
      opened24h,
      resolved24h,
      unresolved,
      averageResolutionHours,
    };
  }, [federationExchangeReceiptEscalationHistory]);

  useEffect(() => {
    if (!federationOperationsSummary) return;
    setStaleAfterHours(String(federationOperationsSummary.distributionVerificationLookbackHours));
  }, [federationOperationsSummary]);

  useEffect(() => {
    setHashPreview(null);
    setServerDigestPreview(null);
  }, [federationPackage?.packageHash, federationPackage?.packagePayload, federationPackage?.digestSourceText]);

  useEffect(() => {
    if (!federationExchangeReceiptPolicySummary) return;
    setReceiptPolicyDraft({
      lookbackHours: String(federationExchangeReceiptPolicySummary.lookbackHours),
      warningPendingThreshold: String(federationExchangeReceiptPolicySummary.warningPendingThreshold),
      criticalPendingThreshold: String(federationExchangeReceiptPolicySummary.criticalPendingThreshold),
      escalationEnabled: federationExchangeReceiptPolicySummary.escalationEnabled,
      oncallChannel: federationExchangeReceiptPolicySummary.oncallChannel || 'public_audit_ops',
      receiptMaxVerificationAgeHours: String(federationExchangeReceiptPolicySummary.receiptMaxVerificationAgeHours),
      criticalStaleReceiptCountThreshold: String(federationExchangeReceiptPolicySummary.criticalStaleReceiptCountThreshold),
    });
    setReceiptAutomationRunDraft((current) => ({
      ...current,
      lookbackHours: String(federationExchangeReceiptPolicySummary.lookbackHours),
    }));
  }, [federationExchangeReceiptPolicySummary]);

  const runSortedKeyHashPreview = useCallback(async () => {
    if (!federationPackage) return;
    setHashPreviewLoading(true);
    try {
      const hex = await previewVerifierFederationPackagePayloadSha256Hex(federationPackage.packagePayload);
      const recorded = federationPackage.packageHash.trim().toLowerCase();
      setHashPreview({ hex, matches: hex === recorded });
    } finally {
      setHashPreviewLoading(false);
    }
  }, [federationPackage]);

  const runServerDigestHashMatch = useCallback(async () => {
    if (!federationPackage?.digestSourceText) return;
    setServerDigestLoading(true);
    try {
      const hex = await sha256HexFromUtf8(federationPackage.digestSourceText);
      const recorded = federationPackage.packageHash.trim().toLowerCase();
      setServerDigestPreview({ hex, matches: hex === recorded });
    } finally {
      setServerDigestLoading(false);
    }
  }, [federationPackage]);

  if (
    !federationPackage
    && !federationPackageDistributionSummary
    && federationPackageSignatures.length === 0
    && federationPackageHistory.length === 0
    && !canManageMirrorFederation
  ) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background p-2 text-muted-foreground">
      <p className="font-medium text-foreground">Federation package distribution</p>

      {federationPackageDistributionSummary && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={federationPackageDistributionSummary.distributionReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Distribution {federationPackageDistributionSummary.distributionReady ? 'ready' : 'pending'}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Signers {federationPackageDistributionSummary.distinctSignerCount}/{federationPackageDistributionSummary.requiredDistributionSignatures}
          </Badge>
          <Badge
            variant="outline"
            className={federationPackageDistributionSummary.federationOpsReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Federation ops {federationPackageDistributionSummary.federationOpsReady ? 'ready' : 'pending'}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Jurisdictions {federationPackageDistributionSummary.distinctSignerJurisdictionsCount}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Trust domains {federationPackageDistributionSummary.distinctSignerTrustDomainsCount}
          </Badge>
        </div>
      )}
      {federationOperationsSummary && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={federationOperationsSummary.distributionVerificationStale
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}
          >
            Verification run {federationOperationsSummary.distributionVerificationStale ? 'stale' : 'fresh'}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Distribution alerts {federationOperationsSummary.openDistributionVerificationAlertCount}
          </Badge>
          <Badge
            variant="outline"
            className={
              federationOperationsSummary.openDistributionStalePackageAlertCount > 0
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-muted text-muted-foreground'
            }
          >
            Stale package alerts {federationOperationsSummary.openDistributionStalePackageAlertCount}
          </Badge>
          <Badge
            variant="outline"
            className={
              federationOperationsSummary.openDistributionBadSignatureAlertCount > 0
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-muted text-muted-foreground'
            }
          >
            Bad signature alerts {federationOperationsSummary.openDistributionBadSignatureAlertCount}
          </Badge>
          <Badge
            variant="outline"
            className={
              federationOperationsSummary.openDistributionPolicyMismatchAlertCount > 0
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-muted text-muted-foreground'
            }
          >
            Policy mismatch alerts {federationOperationsSummary.openDistributionPolicyMismatchAlertCount}
          </Badge>
        </div>
      )}
      {federationExchangeAttestationSummary && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Exchange attestations {federationExchangeAttestationSummary.attestationCount}
          </Badge>
          <Badge
            variant="outline"
            className={
              federationExchangeAttestationSummary.needsFollowupCount > 0
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-border bg-muted text-muted-foreground'
            }
          >
            Needs follow-up {federationExchangeAttestationSummary.needsFollowupCount}
          </Badge>
          <Badge
            variant="outline"
            className={
              federationExchangeAttestationSummary.rejectedCount > 0
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'border-border bg-muted text-muted-foreground'
            }
          >
            Rejected {federationExchangeAttestationSummary.rejectedCount}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Distinct external operators {federationExchangeAttestationSummary.distinctExternalOperatorCount}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Receipt evidence {federationExchangeAttestationSummary.receiptEvidenceCount}
          </Badge>
          <Badge
            variant="outline"
            className={
              federationExchangeAttestationSummary.receiptPendingVerificationCount > 0
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }
          >
            Receipt pending {federationExchangeAttestationSummary.receiptPendingVerificationCount}
          </Badge>
        </div>
      )}
      {federationExchangeReceiptPolicySummary && (
        <div className="rounded-md border border-border/60 bg-card p-2 text-xs">
          <p className="font-medium text-foreground">Receipt escalation policy</p>
          {federationExchangeReceiptAutomationStatus && (
            <div className="mt-2 rounded border border-border/60 bg-background/70 p-2 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Receipt escalation automation status</p>
              {receiptAutomationHealth && (
                <Badge
                  variant="outline"
                  className={
                    receiptAutomationHealth.healthy
                      ? 'mt-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'mt-2 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  }
                >
                  {receiptAutomationHealth.label}
                </Badge>
              )}
              <p className="mt-1">
                pg_cron: {
                  federationExchangeReceiptAutomationStatus.cronSchemaAvailable
                    ? (federationExchangeReceiptAutomationStatus.cronJobRegistered
                        ? (federationExchangeReceiptAutomationStatus.cronJobActive ? 'registered and active' : 'registered but paused')
                        : 'available but not registered')
                    : 'unavailable'
                }
              </p>
              <p>
                Schedule: {federationExchangeReceiptAutomationStatus.cronJobSchedule || 'n/a'}
                {' • '}
                Command: {federationExchangeReceiptAutomationStatus.cronJobCommand || 'n/a'}
              </p>
              <p>
                Latest cron run: {formatTimestamp(federationExchangeReceiptAutomationStatus.latestCronRunStartedAt)}
                {federationExchangeReceiptAutomationStatus.latestCronRunStatus
                  ? ` • ${federationExchangeReceiptAutomationStatus.latestCronRunStatus}`
                  : ''}
                {federationExchangeReceiptAutomationStatus.latestCronRunDetails
                  ? ` • ${federationExchangeReceiptAutomationStatus.latestCronRunDetails}`
                  : ''}
              </p>
              <p>
                Latest pending receipt attested: {formatTimestamp(federationExchangeReceiptAutomationStatus.latestPendingReceiptAttestedAt)}
                {' • '}
                Latest verified receipt: {formatTimestamp(federationExchangeReceiptAutomationStatus.latestVerifiedReceiptAt)}
              </p>
              <p>
                Latest escalation page: {formatTimestamp(federationExchangeReceiptAutomationStatus.latestEscalationPageOpenedAt)}
                {federationExchangeReceiptAutomationStatus.latestEscalationPageStatus
                  ? ` • ${federationExchangeReceiptAutomationStatus.latestEscalationPageStatus}`
                  : ''}
              </p>
            </div>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              value={receiptPolicyDraft.lookbackHours}
              onChange={(event) => setReceiptPolicyDraft((current) => ({ ...current, lookbackHours: event.target.value }))}
              placeholder="Lookback (hours)"
            />
            <Input
              value={receiptPolicyDraft.warningPendingThreshold}
              onChange={(event) => setReceiptPolicyDraft((current) => ({ ...current, warningPendingThreshold: event.target.value }))}
              placeholder="Warning threshold (pending)"
            />
            <Input
              value={receiptPolicyDraft.criticalPendingThreshold}
              onChange={(event) => setReceiptPolicyDraft((current) => ({ ...current, criticalPendingThreshold: event.target.value }))}
              placeholder="Critical threshold (pending)"
            />
            <Input
              value={receiptPolicyDraft.oncallChannel}
              onChange={(event) => setReceiptPolicyDraft((current) => ({ ...current, oncallChannel: event.target.value }))}
              placeholder="On-call channel"
            />
            <Input
              value={receiptPolicyDraft.receiptMaxVerificationAgeHours}
              onChange={(event) => setReceiptPolicyDraft((current) => ({ ...current, receiptMaxVerificationAgeHours: event.target.value }))}
              placeholder="Max receipt age (hours)"
            />
            <Input
              value={receiptPolicyDraft.criticalStaleReceiptCountThreshold}
              onChange={(event) => setReceiptPolicyDraft((current) => ({ ...current, criticalStaleReceiptCountThreshold: event.target.value }))}
              placeholder="Critical stale-count threshold"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => setReceiptPolicyDraft((current) => ({ ...current, escalationEnabled: !current.escalationEnabled }))}
            >
              Escalation {receiptPolicyDraft.escalationEnabled ? 'enabled' : 'disabled'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={savingFederationExchangeReceiptPolicy}
              onClick={() => void saveFederationExchangeReceiptPolicy({
                lookbackHours: receiptPolicyDraft.lookbackHours,
                warningPendingThreshold: receiptPolicyDraft.warningPendingThreshold,
                criticalPendingThreshold: receiptPolicyDraft.criticalPendingThreshold,
                escalationEnabled: receiptPolicyDraft.escalationEnabled,
                oncallChannel: receiptPolicyDraft.oncallChannel,
                receiptMaxVerificationAgeHours: receiptPolicyDraft.receiptMaxVerificationAgeHours,
                criticalStaleReceiptCountThreshold: receiptPolicyDraft.criticalStaleReceiptCountThreshold,
              })}
            >
              {savingFederationExchangeReceiptPolicy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save receipt escalation policy
            </Button>
            <Input
              value={receiptAutomationRunDraft.lookbackHours}
              onChange={(event) => setReceiptAutomationRunDraft((current) => ({ ...current, lookbackHours: event.target.value }))}
              placeholder="Manual run lookback (hours)"
            />
            <Input
              value={receiptAutomationRunDraft.runMessage}
              onChange={(event) => setReceiptAutomationRunDraft((current) => ({ ...current, runMessage: event.target.value }))}
              placeholder="Manual run note (optional)"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 sm:col-span-2"
              disabled={runningFederationExchangeReceiptAutomationCheck}
              onClick={() => void runFederationExchangeReceiptAutomationCheck({
                lookbackHours: receiptAutomationRunDraft.lookbackHours,
                runMessage: receiptAutomationRunDraft.runMessage,
              })}
            >
              {runningFederationExchangeReceiptAutomationCheck ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run receipt automation check now
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Updated {formatTimestamp(federationExchangeReceiptPolicySummary.updatedAt)}
            {federationExchangeReceiptPolicySummary.updatedByName ? ` by ${federationExchangeReceiptPolicySummary.updatedByName}` : ''}
          </p>
          {federationExchangeReceiptPolicyEvents.length > 0 && (
            <details className="mt-2 rounded border border-border/60 bg-background/70 p-2">
              <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                Receipt policy timeline
              </summary>
              <div className="mt-2 space-y-2">
                {federationExchangeReceiptPolicyEvents.slice(0, 20).map((event) => (
                  <div key={event.eventId} className="rounded border border-border/50 bg-background/60 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{event.eventType.toUpperCase()}</p>
                      <p>{formatTimestamp(event.createdAt)}</p>
                    </div>
                    <p className="mt-1">{event.eventMessage}</p>
                    {event.actorName ? <p className="mt-1 text-[11px]">Actor: {event.actorName}</p> : null}
                    {(event.eventType === 'created' || event.eventType === 'updated') ? (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={rollingBackFederationExchangeReceiptPolicyEventId === event.eventId}
                          onClick={() => void rollbackFederationExchangeReceiptPolicyToEvent(event.eventId)}
                        >
                          {rollingBackFederationExchangeReceiptPolicyEventId === event.eventId ? 'Rolling back...' : 'Rollback to snapshot'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          )}
          {federationExchangeReceiptAutomationRuns.length > 0 && (
            <details className="mt-2 rounded border border-border/60 bg-background/70 p-2">
              <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                Receipt automation run history
              </summary>
              <div className="mt-2 space-y-2">
                {federationExchangeReceiptAutomationRuns.slice(0, 20).map((run) => (
                  <div key={run.runId} className="rounded border border-border/50 bg-background/60 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {run.runStatus.toUpperCase()} • {run.triggerSource.replaceAll('_', ' ')}
                      </p>
                      <p>{formatTimestamp(run.runStartedAt)}</p>
                    </div>
                    <p className="mt-1">
                      Pending {run.receiptPendingCount} • Stale {run.staleReceiptCount} • Open/Ack pages {run.openOrAckPageCount}
                    </p>
                    <p className="mt-1">
                      Critical backlog {run.criticalBacklog ? 'yes' : 'no'}
                      {run.requestedLookbackHours !== null ? ` • lookback ${run.requestedLookbackHours}h` : ''}
                    </p>
                    {run.triggeredByName ? <p className="mt-1 text-[11px]">Triggered by {run.triggeredByName}</p> : null}
                    {run.runMessage ? <p className="mt-1 text-[11px]">{run.runMessage}</p> : null}
                  </div>
                ))}
              </div>
            </details>
          )}
          {federationExchangeReceiptEscalationPages.length > 0 && (
            <details className="mt-2 rounded border border-border/60 bg-background/70 p-2">
              <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                Receipt escalation on-call pages
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-border/50 bg-background/60 p-2 text-[11px]">
                  <p className="font-medium text-foreground">24h incident flow</p>
                  <p className="mt-1">Opened (24h): {receiptEscalationHistoryAnalytics.opened24h}</p>
                  <p>Resolved (24h): {receiptEscalationHistoryAnalytics.resolved24h}</p>
                </div>
                <div className="rounded border border-border/50 bg-background/60 p-2 text-[11px]">
                  <p className="font-medium text-foreground">Resolution quality</p>
                  <p className="mt-1">Unresolved pages: {receiptEscalationHistoryAnalytics.unresolved}</p>
                  <p>
                    Average resolution:
                    {' '}
                    {receiptEscalationHistoryAnalytics.averageResolutionHours === null
                      ? 'n/a'
                      : `${receiptEscalationHistoryAnalytics.averageResolutionHours.toFixed(2)}h`}
                  </p>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {federationExchangeReceiptEscalationPages.map((page) => (
                  <div key={page.pageId} className="rounded border border-border/50 bg-background/60 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{page.pageStatus.toUpperCase()} • {page.severity.toUpperCase()}</p>
                      <p>{formatTimestamp(page.openedAt)}</p>
                    </div>
                    <p className="mt-1">{page.pageMessage}</p>
                    <p className="mt-1 text-[11px]">On-call channel: {page.oncallChannel}</p>
                    {canManageMirrorFederation && page.pageStatus !== 'resolved' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={acknowledgingFederationExchangeReceiptEscalationPageId === page.pageId}
                          onClick={() => void acknowledgeFederationExchangeReceiptEscalationPage(page.pageId)}
                        >
                          {acknowledgingFederationExchangeReceiptEscalationPageId === page.pageId ? 'Acknowledging...' : 'Acknowledge page'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={resolvingFederationExchangeReceiptEscalationPageId === page.pageId}
                          onClick={() => void resolveFederationExchangeReceiptEscalationPage(page.pageId)}
                        >
                          {resolvingFederationExchangeReceiptEscalationPageId === page.pageId ? 'Resolving...' : 'Resolve page'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {(distributionReadinessIssues.length > 0 || opsReadinessIssues.length > 0) && (
        <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-medium text-foreground">Readiness blockers</p>
          {distributionReadinessIssues.map((issue) => (
            <p key={`dist-${issue}`}>- {formatGovernancePublicAuditVerifierFederationDistributionReadinessIssue(issue)}</p>
          ))}
          {opsReadinessIssues.map((issue) => (
            <p key={`ops-${issue}`}>- {formatGovernancePublicAuditVerifierFederationOpsReadinessIssue(issue)}</p>
          ))}
        </div>
      )}

      {federationPackage && (
        <div className="space-y-1 rounded-md border border-border/60 bg-card p-2 text-xs">
          <p>
            <span className="font-medium text-foreground">Package:</span> {federationPackage.packageVersion}
          </p>
          <p>
            <span className="font-medium text-foreground">Hash:</span> {previewHash(federationPackage.packageHash)}
          </p>
          <p>
            <span className="font-medium text-foreground">Directory:</span> {previewHash(federationPackage.sourceDirectoryHash)}
          </p>
          <p>
            <span className="font-medium text-foreground">Ops readiness:</span> {federationPackage.federationOpsReady ? 'ready' : 'pending'}
          </p>
          <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
            {federationPackage.digestSourceText ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-0 py-1 text-xs text-muted-foreground hover:text-foreground"
                disabled={serverDigestLoading}
                onClick={() => void runServerDigestHashMatch()}
              >
                {serverDigestLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                Verify SHA-256 of server digest text (matches package hash)
              </Button>
            ) : null}
            {serverDigestPreview ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">Server digest SHA-256:</span> {previewHash(serverDigestPreview.hex)}
                {' — '}
                {serverDigestPreview.matches
                  ? 'Matches recorded package hash (inter-operator safe).'
                  : 'Does not match recorded hash.'}
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start px-0 py-1 text-xs text-muted-foreground hover:text-foreground"
              disabled={hashPreviewLoading}
              onClick={() => void runSortedKeyHashPreview()}
            >
              {hashPreviewLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Preview sorted-key JSON SHA-256 (offline cross-check)
            </Button>
            {hashPreview ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">Preview:</span> {previewHash(hashPreview.hex)}
                {' — '}
                {hashPreview.matches
                  ? 'Matches recorded package hash.'
                  : 'Does not match recorded hash (Postgres jsonb text can differ from sorted JSON).'}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {canManageMirrorFederation && (
        <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
          <Input
            value={packageNotes}
            onChange={(event) => setPackageNotes(event.target.value)}
            placeholder="Package capture notes (optional)"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={capturingFederationPackage}
            onClick={() => void captureFederationPackage(packageNotes)}
          >
            {capturingFederationPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Capture federation distribution package
          </Button>
          <p className="text-xs text-muted-foreground">
            Capture uses the latest signed mirror directory for the batch; its publishing signer must be active and governance-approved.
          </p>
          <Input
            value={staleAfterHours}
            onChange={(event) => setStaleAfterHours(event.target.value)}
            placeholder="Stale package window in hours (default: 24)"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={verifyingFederationDistribution}
            onClick={() => void runFederationDistributionVerification(staleAfterHours)}
          >
            {verifyingFederationDistribution ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run distribution verification
          </Button>

          <Input
            value={signatureDraft.signerKey}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, signerKey: event.target.value }))}
            placeholder="Distribution signer key"
          />
          <Input
            value={signatureDraft.signature}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, signature: event.target.value }))}
            placeholder="Distribution signature"
          />
          <Input
            value={signatureDraft.signatureAlgorithm}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, signatureAlgorithm: event.target.value }))}
            placeholder="Signature algorithm"
          />
          <Input
            value={signatureDraft.signerTrustDomain}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, signerTrustDomain: event.target.value }))}
            placeholder="Signer trust domain"
          />
          <Input
            value={signatureDraft.signerJurisdictionCountryCode}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, signerJurisdictionCountryCode: event.target.value.toUpperCase() }))}
            placeholder="Signer jurisdiction country code (optional)"
            maxLength={2}
          />
          <Input
            value={signatureDraft.signerIdentityUri}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, signerIdentityUri: event.target.value }))}
            placeholder="Signer identity URI (optional)"
          />
          <Input
            value={signatureDraft.distributionChannel}
            onChange={(event) => setSignatureDraft((current) => ({ ...current, distributionChannel: event.target.value }))}
            placeholder="Distribution channel"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={signingFederationPackage || !signingTargetPackageId || !signatureDraft.signerKey.trim() || !signatureDraft.signature.trim()}
            onClick={() => void signFederationPackage({
              packageId: signingTargetPackageId,
              signerKey: signatureDraft.signerKey,
              signature: signatureDraft.signature,
              signatureAlgorithm: signatureDraft.signatureAlgorithm,
              signerTrustDomain: signatureDraft.signerTrustDomain,
              signerJurisdictionCountryCode: signatureDraft.signerJurisdictionCountryCode,
              signerIdentityUri: signatureDraft.signerIdentityUri,
              distributionChannel: signatureDraft.distributionChannel,
            })}
          >
            {signingFederationPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign federation package distribution
          </Button>
          {!signingTargetPackageId && (
            <p className="text-xs text-muted-foreground">
              Capture a federation package first before recording signatures.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The distribution signer key must match an active, governance-approved entry in verifier mirror directory signers.
          </p>
          <div className="mt-1 rounded-md border border-border/60 bg-background/40 p-2">
            <p className="mb-2 text-xs font-medium text-foreground">Record cross-operator exchange attestation</p>
            <div className="space-y-2">
              <Input
                value={exchangeAttestationDraft.operatorLabel}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, operatorLabel: event.target.value }))}
                placeholder="Operator label"
              />
              <Input
                value={exchangeAttestationDraft.operatorIdentityUri}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, operatorIdentityUri: event.target.value }))}
                placeholder="Operator identity URI (optional)"
              />
              <Input
                value={exchangeAttestationDraft.operatorTrustDomain}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, operatorTrustDomain: event.target.value }))}
                placeholder="Operator trust domain"
              />
              <Input
                value={exchangeAttestationDraft.operatorJurisdictionCountryCode}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, operatorJurisdictionCountryCode: event.target.value.toUpperCase() }))}
                placeholder="Operator jurisdiction country code (optional)"
                maxLength={2}
              />
              <Input
                value={exchangeAttestationDraft.exchangeChannel}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, exchangeChannel: event.target.value }))}
                placeholder="Exchange channel"
              />
              <Input
                value={exchangeAttestationDraft.attestationVerdict}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, attestationVerdict: event.target.value }))}
                placeholder="Attestation verdict (accepted|rejected|needs_followup)"
              />
              <Input
                value={exchangeAttestationDraft.attestationNotes}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, attestationNotes: event.target.value }))}
                placeholder="Attestation notes (optional)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={recordingFederationExchangeAttestation || !signingTargetPackageId || !exchangeAttestationDraft.operatorLabel.trim()}
                onClick={() => void recordFederationExchangeAttestation({
                  packageId: signingTargetPackageId,
                  operatorLabel: exchangeAttestationDraft.operatorLabel,
                  operatorIdentityUri: exchangeAttestationDraft.operatorIdentityUri,
                  operatorTrustDomain: exchangeAttestationDraft.operatorTrustDomain,
                  operatorJurisdictionCountryCode: exchangeAttestationDraft.operatorJurisdictionCountryCode,
                  exchangeChannel: exchangeAttestationDraft.exchangeChannel,
                  attestationVerdict: exchangeAttestationDraft.attestationVerdict,
                  attestationNotes: exchangeAttestationDraft.attestationNotes,
                  receiptPayloadText: exchangeAttestationDraft.receiptPayloadText,
                  receiptSignature: exchangeAttestationDraft.receiptSignature,
                  receiptSignerKey: exchangeAttestationDraft.receiptSignerKey,
                  receiptSignatureAlgorithm: exchangeAttestationDraft.receiptSignatureAlgorithm,
                })}
              >
                {recordingFederationExchangeAttestation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Record exchange attestation
              </Button>
              <Input
                value={exchangeAttestationDraft.receiptPayloadText}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, receiptPayloadText: event.target.value }))}
                placeholder='Receipt payload JSON (optional)'
              />
              <Input
                value={exchangeAttestationDraft.receiptSignature}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, receiptSignature: event.target.value }))}
                placeholder='Receipt signature (optional)'
              />
              <Input
                value={exchangeAttestationDraft.receiptSignerKey}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, receiptSignerKey: event.target.value }))}
                placeholder='Receipt signer key (optional)'
              />
              <Input
                value={exchangeAttestationDraft.receiptSignatureAlgorithm}
                onChange={(event) => setExchangeAttestationDraft((current) => ({ ...current, receiptSignatureAlgorithm: event.target.value }))}
                placeholder='Receipt signature algorithm (optional)'
              />
            </div>
          </div>
        </div>
      )}

      {federationPackageDistributionSummary && (
        <p className="text-xs text-muted-foreground">
          Latest capture {formatTimestamp(federationPackageDistributionSummary.capturedAt)}
          {' '}• Last signature {formatTimestamp(federationPackageDistributionSummary.lastSignedAt)}
        </p>
      )}
      {federationOperationsSummary && (
        <p className="text-xs text-muted-foreground">
          Last distribution verification {formatTimestamp(federationOperationsSummary.lastDistributionVerificationRunAt)}
          {' '}• status {federationOperationsSummary.lastDistributionVerificationRunStatus}
          {' '}• lookback {federationOperationsSummary.distributionVerificationLookbackHours}h
        </p>
      )}

      {federationPackageHistory.length > 0 && (
        <div className="space-y-1 rounded-md border border-border/60 bg-card p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Recent federation packages (this batch)</p>
          {federationPackageHistory.map((row) => (
            <div key={row.packageId} className="flex flex-wrap justify-between gap-2 border-t border-border/40 pt-1 first:border-t-0 first:pt-0">
              <span>{formatTimestamp(row.capturedAt)}</span>
              <span>sig {row.signatureCount}</span>
              <span className="w-full font-mono text-[10px] text-muted-foreground">{previewHash(row.packageHash)}</span>
            </div>
          ))}
        </div>
      )}

      {federationPackageSignatures.length > 0 && (
        <div className="space-y-1">
          {federationPackageSignatures.map((signature) => (
            <div key={signature.signatureId} className="rounded-md border border-border/60 bg-card p-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{signature.signerKey}</p>
                <span>{formatTimestamp(signature.signedAt)}</span>
              </div>
              <p className="mt-1">
                Package {previewHash(signature.packageHash)} • {signature.signatureAlgorithm} • channel {signature.distributionChannel}
              </p>
              <p>
                Trust domain {signature.signerTrustDomain}
                {signature.signerJurisdictionCountryCode ? ` • ${signature.signerJurisdictionCountryCode}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
      {federationExchangeAttestations.length > 0 && (
        <div className="space-y-1 rounded-md border border-border/60 bg-card p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cross-operator exchange attestations</p>
          {federationExchangeAttestations.slice(0, 12).map((attestation) => (
            <div key={attestation.attestationId} className="rounded-md border border-border/50 bg-background/60 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{attestation.operatorLabel}</p>
                <span>{formatTimestamp(attestation.attestedAt)}</span>
              </div>
              <p className="mt-1">
                Verdict {attestation.attestationVerdict} • Channel {attestation.exchangeChannel} • Trust domain {attestation.operatorTrustDomain}
                {attestation.operatorJurisdictionCountryCode ? ` • ${attestation.operatorJurisdictionCountryCode}` : ''}
              </p>
              {attestation.attestedByName ? (
                <p className="mt-1">Recorded by {attestation.attestedByName}</p>
              ) : null}
              {attestation.attestationNotes ? (
                <p className="mt-1 text-[11px] leading-snug">{attestation.attestationNotes}</p>
              ) : null}
              <p className="mt-1 text-[11px] leading-snug">
                Receipt evidence {attestation.receiptSignature && attestation.receiptSignerKey ? 'present' : 'missing'}
                {' • '}
                Verification {attestation.receiptVerified ? 'verified' : 'pending'}
                {attestation.receiptVerifiedByName ? ` by ${attestation.receiptVerifiedByName}` : ''}
              </p>
              {attestation.receiptVerificationNotes ? (
                <p className="mt-1 text-[11px] leading-snug">{attestation.receiptVerificationNotes}</p>
              ) : null}
              {canManageMirrorFederation && attestation.receiptSignature && attestation.receiptSignerKey ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={verifyingFederationExchangeReceipt}
                    onClick={() => void verifyFederationExchangeReceipt({
                      attestationId: attestation.attestationId,
                      receiptVerified: true,
                      receiptVerificationNotes: 'Verified by governance stewardship from provided exchange receipt evidence.',
                    })}
                  >
                    Mark receipt verified
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={verifyingFederationExchangeReceipt}
                    onClick={() => void verifyFederationExchangeReceipt({
                      attestationId: attestation.attestationId,
                      receiptVerified: false,
                      receiptVerificationNotes: 'Receipt evidence reviewed and marked unverified by governance stewardship.',
                    })}
                  >
                    Mark receipt unverified
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
