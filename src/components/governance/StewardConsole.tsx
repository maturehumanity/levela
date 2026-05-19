import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { StewardConsoleIdentityVerification } from './StewardConsoleIdentityVerification';
import { StewardConsoleOfficeManagement } from './StewardConsoleOfficeManagement';

type StewardTab = 'verifications' | 'offices' | 'policies';

export function StewardConsole() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<StewardTab>('verifications');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('governance.stewardConsole')}</h2>
        <p className="text-muted-foreground mt-1">
          Manage governance operations, identity verifications, and constitutional offices.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StewardTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="verifications">Identity Verifications</TabsTrigger>
          <TabsTrigger value="offices">Constitutional Offices</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="verifications" className="space-y-4">
          <StewardConsoleIdentityVerification />
        </TabsContent>

        <TabsContent value="offices" className="space-y-4">
          <StewardConsoleOfficeManagement />
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Governance Policies</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Voting Policies</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure voting thresholds, quorum requirements, and voting periods.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Verification Policies</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage identity verification requirements and provider configurations.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Federation Exchange Policies</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Control verifier federation exchange settings and distribution rules.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
