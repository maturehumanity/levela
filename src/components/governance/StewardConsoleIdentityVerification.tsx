import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchIdentityVerificationStatus, canPerformAction, GovernanceAction } from '@/lib/governance-ui-utils';
import { formatVerificationStatus } from '@/lib/governance-ui-utils';
import type { IdentityVerification } from '@/lib/governance-ui.types';

export function StewardConsoleIdentityVerification() {
  const { t } = useLanguage();
  const [verifications, setVerifications] = useState<IdentityVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const hasPermission = await canPerformAction(GovernanceAction.MANAGE_VERIFICATIONS);
      setCanManage(hasPermission);

      if (hasPermission) {
        const data = await fetchIdentityVerificationStatus();
        setVerifications(data);
      }
    } catch (error) {
      console.error('Error loading identity verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificationId: string) => {
    setProcessingId(verificationId);
    try {
      // Call approval RPC here
      console.log('Approving verification:', verificationId);
      await loadData();
    } catch (error) {
      console.error('Error approving verification:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (verificationId: string) => {
    setProcessingId(verificationId);
    try {
      // Call rejection RPC here
      console.log('Rejecting verification:', verificationId);
      await loadData();
    } catch (error) {
      console.error('Error rejecting verification:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!canManage) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">{t('governance.notAuthorized')}</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingVerifications = verifications.filter((v) => v.verification_status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Identity Verifications</h3>
        <Badge variant="outline">{pendingVerifications.length} Pending</Badge>
      </div>

      {verifications.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No identity verifications to review</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {verifications.map((verification) => (
            <Card key={verification.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{verification.profile_username}</h4>
                    <Badge variant={verification.verification_status === 'approved' ? 'default' : 'secondary'}>
                      {formatVerificationStatus(verification.verification_status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Provider: {verification.provider_name}
                  </p>
                  {verification.verified_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Verified: {new Date(verification.verified_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {verification.verification_status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApprove(verification.id)}
                      disabled={processingId === verification.id}
                    >
                      {processingId === verification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(verification.id)}
                      disabled={processingId === verification.id}
                    >
                      {processingId === verification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-1" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
