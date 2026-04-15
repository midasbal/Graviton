/**
 * Skeleton — Loading placeholder components for Graviton UI.
 * Used during data fetching to provide visual feedback.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-border/40 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Skeleton card matching AgentCard layout */
export function AgentCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** Grid of skeleton cards for the marketplace */
export function AgentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the agent detail page header */
export function AgentDetailSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-7 space-y-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center space-y-2">
            <Skeleton className="h-5 w-5 rounded mx-auto" />
            <Skeleton className="h-6 w-16 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* Storage section */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-7 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for dashboard stats row */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-10">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Generic error state */
export function ErrorState({
  title = "Something went wrong",
  description = "Failed to load data. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 mb-5">
        <svg className="h-8 w-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-lg font-medium text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted mb-6 max-w-md text-center">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/** ChainScan transaction link */
export function TxLink({ hash, label }: { hash: string; label?: string }) {
  const explorerUrl = "https://chainscan-galileo.0g.ai";
  return (
    <a
      href={`${explorerUrl}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-mono text-accent-light hover:underline"
    >
      {label ?? `${hash.slice(0, 10)}…`}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
