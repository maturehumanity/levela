import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchConstitutionalOffices, fetchOfficeHolders, canPerformAction, GovernanceAction } from '@/lib/governance-ui-utils';
import type { ConstitutionalOffice, ConstitutionalOfficeHolder } from '@/lib/governance-ui.types';

export function StewardConsoleOfficeManagement() {
  const { t } = useLanguage();
  const [offices, setOffices] = useState<ConstitutionalOffice[]>([]);
  const [holders, setHolders] = useState<Record<string, ConstitutionalOfficeHolder[]>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [newHolderUsername, setNewHolderUsername] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const hasPermission = await canPerformAction(GovernanceAction.MANAGE_OFFICES);
      setCanManage(hasPermission);

      if (hasPermission) {
        const officesData = await fetchConstitutionalOffices();
        setOffices(officesData);

        // Load holders for each office
        for (const office of officesData) {
          const holdersData = await fetchOfficeHolders(office.id);
          setHolders((prev) => ({
            ...prev,
            [office.id]: holdersData,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading offices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAppointHolder = async (officeId: string) => {
    if (!newHolderUsername.trim()) return;

    setProcessingId(officeId);
    try {
      // Call appointment RPC here
      console.log('Appointing holder:', newHolderUsername, 'to office:', officeId);
      setNewHolderUsername('');
      await loadData();
    } catch (error) {
      console.error('Error appointing holder:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeHolder = async (holderId: string) => {
    setProcessingId(holderId);
    try {
      // Call revocation RPC here
      console.log('Revoking holder:', holderId);
      await loadData();
    } catch (error) {
      console.error('Error revoking holder:', error);
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Constitutional Offices</h3>

      {offices.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No constitutional offices configured</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {offices.map((office) => {
            const officeHolders = holders[office.id] || [];
            const isExpanded = selectedOfficeId === office.id;

            return (
              <Card key={office.id} className="p-4">
                <div
                  className="flex items-start justify-between gap-4 cursor-pointer"
                  onClick={() => setSelectedOfficeId(isExpanded ? null : office.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{office.office_name}</h4>
                      <Badge variant="outline">{officeHolders.length}/{office.max_holders}</Badge>
                    </div>
                    {office.office_description && (
                      <p className="text-sm text-muted-foreground mt-1">{office.office_description}</p>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3 pt-4 border-t">
                    {/* Current Holders */}
                    <div>
                      <h5 className="text-sm font-medium mb-2">Current Holders</h5>
                      {officeHolders.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No holders assigned</p>
                      ) : (
                        <div className="space-y-2">
                          {officeHolders.map((holder) => (
                            <div key={holder.holder_id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <p className="text-sm font-medium">{holder.profile_username}</p>
                                <p className="text-xs text-muted-foreground">
                                  Term: {new Date(holder.term_start_at).toLocaleDateString()} -{' '}
                                  {new Date(holder.term_end_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevokeHolder(holder.holder_id)}
                                disabled={processingId === holder.holder_id}
                              >
                                {processingId === holder.holder_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Appoint New Holder */}
                    {officeHolders.length < office.max_holders && (
                      <div className="space-y-2 pt-2 border-t">
                        <h5 className="text-sm font-medium">Appoint New Holder</h5>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Username"
                            value={newHolderUsername}
                            onChange={(e) => setNewHolderUsername(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAppointHolder(office.id);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAppointHolder(office.id)}
                            disabled={processingId === office.id || !newHolderUsername.trim()}
                          >
                            {processingId === office.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
