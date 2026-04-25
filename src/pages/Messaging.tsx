import { Suspense, lazy } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

const ChatBar = lazy(() =>
  import('@/components/ui/chat-bar').then((module) => ({ default: module.ChatBar })),
);

export default function Messaging() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [searchParams] = useSearchParams();
  const focusMessageId = searchParams.get('focusMessageId');

  return (
    <AppLayout>
      <div className="flex h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden px-4 pb-4 pt-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={null}>
            <ChatBar
              initialExpanded
              variant="page"
              routeConversationId={conversationId ?? null}
              routeFocusMessageId={focusMessageId}
            />
          </Suspense>
        </div>
      </div>
    </AppLayout>
  );
}
