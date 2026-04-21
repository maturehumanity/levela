import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  GovernanceProposalGuardianRelayClientProofManifest,
  GovernanceProposalGuardianRelayRecentClientManifestRow,
  GovernanceProposalGuardianRelayTrustMinimizedSummary,
} from '@/lib/governance-guardian-relays';

interface GovernanceGuardianRelayProofSectionProps {
  canManageGuardianRelays: boolean;
  relayTrustMinimizedSummary: GovernanceProposalGuardianRelayTrustMinimizedSummary | null;
  relayClientProofManifest: GovernanceProposalGuardianRelayClientProofManifest | null;
  relayRecentClientManifests: GovernanceProposalGuardianRelayRecentClientManifestRow[];
  capturingRelayClientManifest: boolean;
  onCaptureRelayClientManifest: (manifestNotes: string) => Promise<void> | void;
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
  capturingRelayClientManifest,
  onCaptureRelayClientManifest,
  formatTimestamp,
}: GovernanceGuardianRelayProofSectionProps) {
  const [manifestNotes, setManifestNotes] = useState('');

  if (!relayTrustMinimizedSummary && !relayClientProofManifest && relayRecentClientManifests.length === 0) {
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
