"use client";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-sm)] bg-[var(--elevated)] ${className ?? ""}`}
    />
  );
}

export function ChatListSkeleton() {
  return (
    <div className="screen-panel flex h-full min-h-0 w-full flex-col overflow-hidden">
      <header className="app-header shrink-0 px-4 pb-3">
        <Shimmer className="h-8 w-28" />
        <Shimmer className="mt-2 h-4 w-36" />
        <div className="mt-4 flex gap-2">
          <Shimmer className="h-10 flex-1 rounded-[var(--radius-md)]" />
          <Shimmer className="h-10 flex-1 rounded-[var(--radius-md)]" />
        </div>
      </header>
      <div className="min-h-0 flex-1 px-4 py-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Shimmer className="h-11 w-11 shrink-0 rounded-[var(--radius-full)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex justify-between gap-2">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-10" />
              </div>
              <Shimmer className="h-4 w-full max-w-[220px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-4 px-1 py-2">
      <div className="flex justify-center">
        <Shimmer className="h-6 w-16 rounded-[var(--radius-full)]" />
      </div>
      <div className="flex items-end gap-2">
        <Shimmer className="h-8 w-8 rounded-[var(--radius-full)]" />
        <Shimmer className="h-16 w-[72%] rounded-[var(--radius-lg)]" />
      </div>
      <div className="flex justify-end">
        <Shimmer className="h-12 w-[58%] rounded-[var(--radius-lg)]" />
      </div>
      <div className="flex items-end gap-2">
        <Shimmer className="h-8 w-8 rounded-[var(--radius-full)]" />
        <Shimmer className="h-24 w-[80%] rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="screen-canvas flex h-full min-h-0 flex-col overflow-hidden">
      <header className="app-header hairline-b flex shrink-0 items-center gap-3 px-4 pb-3">
        <Shimmer className="h-9 w-9 rounded-[var(--radius-full)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-3 w-20" />
        </div>
      </header>
      <div className="flex-1 space-y-4 px-4 py-4">
        <MessageListSkeleton />
      </div>
      <div className="app-footer hairline-t shrink-0 px-4 pt-2">
        <Shimmer className="h-12 w-full rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}

export function AppLoadingSkeleton() {
  return (
    <div className="app-shell mx-auto w-full md:grid md:max-w-[960px] md:grid-cols-[320px_1fr] md:border-x md:border-[var(--hairline)]">
      <ChatListSkeleton />
      <div className="hidden md:block md:border-l md:border-[var(--hairline)]">
        <ThreadSkeleton />
      </div>
    </div>
  );
}
