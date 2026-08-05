import { Suspense } from 'react';
import { TriageDesk } from './TriageDesk';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DeskSkeleton />}>
      <TriageDesk />
    </Suspense>
  );
}

function DeskSkeleton() {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[340px] flex-none border-r border-divider bg-paper">
        <div className="border-b border-divider p-3">
          <div className="mb-2 h-9 animate-pulse rounded bg-subtle" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-9 animate-pulse rounded bg-subtle" />
            <div className="h-9 animate-pulse rounded bg-subtle" />
          </div>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex border-b border-divider">
            <span className="w-[3px] flex-none bg-subtle" />
            <div className="flex-1 px-3 py-2.5">
              <div className="mb-2 h-2.5 w-20 animate-pulse rounded-sm bg-subtle" />
              <div className="mb-1.5 h-3 w-full animate-pulse rounded-sm bg-subtle" />
              <div className="h-3 w-3/5 animate-pulse rounded-sm bg-subtle" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 bg-surface" />
    </div>
  );
}
