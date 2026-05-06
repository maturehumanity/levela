import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { checkGovernancePermissions, getAllPermissions } from '@/lib/governance-permission-model';
import { GovernanceProposalsList } from './GovernanceProposalsList';
import { StewardConsole } from './StewardConsole';
import type { GovernanceProposal, GovernancePermissions } from '@/lib/governance-ui.types';

export function GovernanceDashboard() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<GovernancePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<GovernanceProposal | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const perms = await getAllPermissions();
      setPermissions(perms as unknown as GovernancePermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSteward = permissions?.is_office_holder || false;
  const canVote = permissions?.can_vote || false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('governance.title')}</h1>
        <p className="text-muted-foreground mt-2">
          Participate in governance, vote on proposals, and help shape the future of Levela.
        </p>
      </div>

      {/* User Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Your Governance Status</h3>
            <p className="text-sm text-muted-foreground mt-1">{profile?.username}</p>
          </div>
          <div className="flex gap-2">
            {canVote && <Badge variant="default">Can Vote</Badge>}
            {isSteward && <Badge variant="secondary">Steward</Badge>}
            {permissions?.can_create_proposals && <Badge variant="secondary">Can Create Proposals</Badge>}
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="proposals" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proposals">Active Proposals</TabsTrigger>
          {isSteward && <TabsTrigger value="steward">Steward Console</TabsTrigger>}
        </TabsList>

        <TabsContent value="proposals" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Proposals List */}
            <div className="lg:col-span-2">
              <GovernanceProposalsList onProposalSelect={setSelectedProposal} />
            </div>

            {/* Proposal Details */}
            <div>
              {selectedProposal ? (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{selectedProposal.proposal_title}</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                      <p className="text-sm mt-1">{selectedProposal.proposal_description}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Type</h4>
                      <p className="text-sm mt-1">{selectedProposal.proposal_type}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                      <Badge className="mt-1">{selectedProposal.status}</Badge>
                    </div>
                    {selectedProposal.voting_starts_at && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Voting Period</h4>
                        <p className="text-sm mt-1">
                          {new Date(selectedProposal.voting_starts_at).toLocaleDateString()} -{' '}
                          {selectedProposal.voting_ends_at
                            ? new Date(selectedProposal.voting_ends_at).toLocaleDateString()
                            : 'Ongoing'}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">Select a proposal to view details</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {isSteward && (
          <TabsContent value="steward" className="space-y-4">
            <StewardConsole />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
