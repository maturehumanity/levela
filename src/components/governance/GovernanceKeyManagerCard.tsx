import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type GovernanceKeyManagerCardProps = {
  citizenKeyFingerprint: string | null;
  citizenKeyMismatch: boolean;
  generatingCitizenKey: boolean;
  governanceIntentBackendUnavailable: boolean;
  hasLocalCitizenKey: boolean;
  profileId?: string | null;
  registeredPublicKey?: string | null;
  t: (key: string) => string;
  onRegisterCitizenKey: () => void;
  onRemoveLocalCitizenKey: () => void;
};

export function GovernanceKeyManagerCard({
  citizenKeyFingerprint,
  citizenKeyMismatch,
  generatingCitizenKey,
  governanceIntentBackendUnavailable,
  hasLocalCitizenKey,
  profileId,
  registeredPublicKey,
  t,
  onRegisterCitizenKey,
  onRemoveLocalCitizenKey,
}: GovernanceKeyManagerCardProps) {
  return (
    <Card className="mb-3 border-border/70 bg-card/95 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('governance.keyManagerTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('governance.keyManagerDescription')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={registeredPublicKey ? 'secondary' : 'outline'}>{registeredPublicKey ? t('governance.keyRegistered') : t('governance.keyNotRegistered')}</Badge>
            <Badge variant={hasLocalCitizenKey ? 'secondary' : 'outline'}>{hasLocalCitizenKey ? t('governance.localKeyReady') : t('governance.localKeyMissing')}</Badge>
            <Badge variant={governanceIntentBackendUnavailable ? 'outline' : 'secondary'}>{governanceIntentBackendUnavailable ? t('governance.signedIntentsOffline') : t('governance.signedIntentsOnline')}</Badge>
            {citizenKeyMismatch && <Badge variant="outline" className="border-amber-500/40 text-amber-700">{t('governance.keyMismatch')}</Badge>}
          </div>

          {citizenKeyFingerprint && <p className="text-xs text-muted-foreground">{t('governance.fingerprintLabel')}: <span className="font-mono">{citizenKeyFingerprint}</span></p>}

          <p className="text-xs text-muted-foreground">
            {citizenKeyMismatch
              ? t('governance.keyStatusHelpMismatch')
              : registeredPublicKey
                ? t('governance.keyStatusHelpRegistered')
                : t('governance.keyStatusHelpBootstrap')}
          </p>

          {governanceIntentBackendUnavailable && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              <span>{t('governance.signedIntentLocalMode')}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onRegisterCitizenKey} className="gap-2" disabled={generatingCitizenKey || !profileId}>
              {generatingCitizenKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {registeredPublicKey ? t('governance.replaceKey') : t('governance.registerKey')}
            </Button>
            <Button variant="outline" onClick={onRemoveLocalCitizenKey} disabled={!hasLocalCitizenKey}>
              {t('governance.removeLocalKey')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
