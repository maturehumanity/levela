import { Suspense } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { GovernanceDashboard } from '@/components/governance/GovernanceDashboard';
import { Loader2 } from 'lucide-react';

function GovernanceLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function GovernanceNewPage() {
  return (
    <AppLayout>
      <Suspense fallback={<GovernanceLoadingFallback />}>
        <GovernanceDashboard />
      </Suspense>
    </AppLayout>
  );
}
