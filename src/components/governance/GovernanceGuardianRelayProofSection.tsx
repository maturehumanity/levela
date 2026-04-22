import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  GovernanceProposalGuardianRelayClientProofManifest,
  GovernanceProposalGuardianRelayClientVerificationDistributionSummary,
  GovernanceProposalGuardianRelayClientVerificationPackage,
  GovernanceProposalGuardianRelayClientVerificationSignatureRow,
  GovernanceProposalGuardianRelayRecentClientManifestRow,
  GovernanceProposalGuardianRelayRecentClientVerificationPackageRow,
  GovernanceProposalGuardianRelayTrustMinimizedSummary,
} from '@/lib/governance-guardian-relays';

interface GovernanceGuardianRelayProofSectionProps {
  canManageGuardianRelays: boolean;
  relayTrustMinimizedSummary: GovernanceProposalGuardianRelayTrustMinimizedSummary | null;
  relayClientProofManifest: GovernanceProposalGuardianRelayClientProofManifest | null;
  relayRecentClientManifests: GovernanceProposalGuardianRelayRecentClientManifestRow[];
  relayClientVerificationPackage: GovernanceProposalGuardianRelayClientVerificationPackage | null;
  relayRecentClientVerificationPackages: GovernanceProposalGuardianRelayRecentClientVerificationPackageRow[];
  relayClientVerificationDistributionSummary: GovernanceProposalGuardianRelayClientVerificationDistributionSummary | null;
  relayClientVerificationSignatures: GovernanceProposalGuardianRelayClientVerificationSignatureRow[];
  capturingRelayClientManifest: boolean;
  capturingRelayClientVerificationPackage: boolean;
  signingRelayClientVerificationPackage: boolean;
  onCaptureRelayClientManifest: (manifestNotes: string) => Promise<void> | void;
  onCaptureRelayClientVerificationPackage: (packageNotes: string) => Promise<void> | void;
  onSignRelayClientVerificationPackage: (draft: {
    packageId: string;
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
    signerTrustDomain: string;
    signerJurisdictionCountryCode: string;
    signerIdentityUri: string;
    distributionChannel: string;
  }) => Promise<void> | void;
  formatTimestamp: (value: string | null) => string;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)}%`;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 20) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function GovernanceGuardianRelayProofSection({
  canManageGuardianRelays,
  relayTrustMinimizedSummary,
  relayClientProofManifest,
  relayRecentClientManifests,
  relayClientVerificationPackage,
  relayRecentClientVerificationPackages,
  relayClientVerificationDistributionSummary,
  relayClientVerificationSignatures,
  capturingRelayClientManifest,
  capturingRelayClientVerificationPackage,
  signingRelayClientVerificationPackage,
  onCaptureRelayClientManifest,
  onCaptureRelayClientVerificationPackage,
  onSignRelayClientVerificationPackage,
  formatTimestamp,
}: GovernanceGuardianRelayProofSectionProps) {
  const [manifestNotes, setManifestNotes] = useState('');
  const [packageNotes, setPackageNotes] = useState('');
  const [signatureDraft, setSignatureDraft] = useState({
    signerKey: '',
    signature: '',
    signatureAlgorithm: 'ed25519',
    signerTrustDomain: 'public',
    signerJurisdictionCountryCode: '',
    signerIdentityUri: '',
    distributionChannel: 'primary',
  });

  const signingTargetPackageId = useMemo(() => {
    if (relayClientVerificationDistributionSummary?.packageId) return relayClientVerificationDistributionSummary.packageId;
    if (relayRecentClientVerificationPackages[0]?.packageId) return relayRecentClientVerificationPackages[0].packageId;
    return '';
  }, [relayClientVerificationDistributionSummary?.packageId, relayRecentClientVerificationPackages]);

  if (
    !relayTrustMinimizedSummary
    && !relayClientProofManifest
    && relayRecentClientManifests.length === 0
    && !relayClientVerificationPackage
    && relayRecentClientVerificationPackages.length === 0
    && !relayClientVerificationDistributionSummary
    && relayClientVerificationSignatures.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card p-2.5 text-xs">
      <p className="font-medium text-foreground">Trust-minimized quorum + client proof manifest</p>

      {relayTrustMinimizedSummary && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={relayTrustMinimizedSummary.trustMinimizedQuorumMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Trust-minimized quorum {relayTrustMinimizedSummary.trustMinimizedQuorumMet ? 'met' : 'pending'}
          </Badge>
          <Badge
            variant="outline"
            className={relayTrustMinimizedSummary.concentrationLimitsMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Concentration {relayTrustMinimizedSummary.concentrationLimitsMet ? 'within policy' : 'above policy'}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Jurisdictions {relayTrustMinimizedSummary.distinctJurisdictionsCount}/{relayTrustMinimizedSummary.minDistinctRelayJurisdictions}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Trust domains {relayTrustMinimizedSummary.distinctTrustDomainsCount}/{relayTrustMinimizedSummary.minDistinctRelayTrustDomains}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Top jurisdiction share {formatPercent(relayTrustMinimizedSummary.dominantJurisdictionSharePercent)}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Top trust-domain share {formatPercent(relayTrustMinimizedSummary.dominantTrustDomainSharePercent)}
          </Badge>
        </div>
      )}

      {relayClientProofManifest && (
        <div className="rounded-md border border-border/60 bg-background p-2 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Live manifest:</span> {relayClientProofManifest.manifestVersion}
          </p>
          <p>
            <span className="font-medium text-foreground">Hash:</span> {previewHash(relayClientProofManifest.manifestHash)}
          </p>
          <p>
            <span className="font-medium text-foreground">Generated:</span> {
              formatTimestamp(
                typeof relayClientProofManifest.manifestPayload.generated_at === 'string'
                  ? relayClientProofManifest.manifestPayload.generated_at
                  : null,
              )
            }
          </p>
          <p>
            <span className="font-medium text-foreground">Relay ops:</span> {relayClientProofManifest.relayOpsReady ? 'ready' : 'pending'}
          </p>
        </div>
      )}

      {relayClientVerificationPackage && (
        <div className="rounded-md border border-border/60 bg-background p-2 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Deterministic package:</span> {relayClientVerificationPackage.packageVersion}
          </p>
          <p>
            <span className="font-medium text-foreground">Package hash:</span> {previewHash(relayClientVerificationPackage.packageHash)}
          </p>
          <p>
            <span className="font-medium text-foreground">Source manifest hash:</span> {previewHash(relayClientVerificationPackage.sourceManifestHash)}
          </p>
          <p>
            <span className="font-medium text-foreground">Trust-minimized quorum:</span> {relayClientVerificationPackage.trustMinimizedQuorumMet ? 'met' : 'pending'}
            {' '}| relay ops {relayClientVerificationPackage.relayOpsReady ? 'ready' : 'pending'}
          </p>
        </div>
      )}

      {relayClientVerificationDistributionSummary && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={relayClientVerificationDistributionSummary.distributionReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Distribution {relayClientVerificationDistributionSummary.distributionReady ? 'ready' : 'pending'}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Signatures {relayClientVerificationDistributionSummary.distinctSignerCount}/{relayClientVerificationDistributionSummary.requiredDistributionSignatures}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Jurisdictions {relayClientVerificationDistributionSummary.distinctSignerJurisdictionsCount}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Trust domains {relayClientVerificationDistributionSummary.distinctSignerTrustDomainsCount}
          </Badge>
        </div>
      )}

      {canManageGuardianRelays && (
        <div className="space-y-2 rounded-md border border-border/60 bg-background p-2">
          <Input
            value={manifestNotes}
            onChange={(event) => setManifestNotes(event.target.value)}
            placeholder="Manifest capture notes (optional)"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={capturingRelayClientManifest}
            onClick={() => void onCaptureRelayClientManifest(manifestNotes)}
          >
            {capturingRelayClientManifest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Capture client-proof manifest snapshot
          </Button>

          <Input
            value={packageNotes}
            onChange={(event) => setPackageNotes(event.target.value)}
            placeholder="Verification package notes (optional)"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={capturingRelayClientVerificationPackage}
            onClick={() => void onCaptureRelayClientVerificationPackage(packageNotes)}
          >
            {capturingRelayClientVerificationPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Capture deterministic verification package
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
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={signingRelayClientVerificationPackage || !signingTargetPackageId || !signatureDraft.signerKey.trim() || !signatureDraft.signature.trim()}
            onClick={() => void onSignRelayClientVerificationPackage({
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
            {signingRelayClientVerificationPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign verification package distribution
          </Button>
        </div>
      )}

      {relayRecentClientVerificationPackages.length > 0 && (
        <div className="space-y-1">
          {relayRecentClientVerificationPackages.slice(0, 6).map((packageRow) => (
            <div key={packageRow.packageId} className="rounded-md border border-border/60 bg-background p-2 text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{packageRow.packageVersion}</p>
                <span>{formatTimestamp(packageRow.capturedAt)}</span>
              </div>
              <p className="mt-1">
                Package hash: <span className="text-foreground">{previewHash(packageRow.packageHash)}</span>
              </p>
              <p>
                Source manifest: <span className="text-foreground">{previewHash(packageRow.sourceManifestHash)}</span>
              </p>
              <p>
                Signatures {packageRow.signatureCount} | distribution {packageRow.distributionReady ? 'ready' : 'pending'}
              </p>
              {packageRow.packageNotes && (
                <p className="mt-1">Notes: <span className="text-foreground">{packageRow.packageNotes}</span></p>
              )}
            </div>
          ))}
        </div>
      )}

      {relayClientVerificationSignatures.length > 0 && (
        <div className="space-y-1">
          {relayClientVerificationSignatures.slice(0, 8).map((signature) => (
            <div key={signature.signatureId} className="rounded-md border border-border/60 bg-background p-2 text-muted-foreground">
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

      {relayRecentClientManifests.length > 0 && (
        <div className="space-y-1">
          {relayRecentClientManifests.slice(0, 6).map((manifest) => (
            <div key={manifest.manifestId} className="rounded-md border border-border/60 bg-background p-2 text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{manifest.manifestVersion}</p>
                <span>{formatTimestamp(manifest.capturedAt)}</span>
              </div>
              <p className="mt-1">
                Hash: <span className="text-foreground">{previewHash(manifest.manifestHash)}</span>
              </p>
              <p>
                Status: {manifest.trustMinimizedQuorumMet ? 'trust-minimized quorum met' : 'quorum pending'}
                {' '}| relay {manifest.relayQuorumMet ? 'ok' : 'pending'}
                {' '}| chain-proof {manifest.chainProofMatchMet ? 'ok' : 'pending'}
              </p>
              {manifest.manifestNotes && (
                <p className="mt-1">Notes: <span className="text-foreground">{manifest.manifestNotes}</span></p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
