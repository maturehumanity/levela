import { AppLayout } from '@/components/layout/AppLayout';
import { UnifiedSearchBlock } from '@/components/search/UnifiedSearchBlock';

export default function Search() {
  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <UnifiedSearchBlock showTitle syncUrlParams />
      </div>
    </AppLayout>
  );
}
