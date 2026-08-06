export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gray-200/80 ${className}`}
      aria-hidden
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading listing">
      <Skeleton className="aspect-[20/13] w-full rounded-2xl" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/5" />
        </div>
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
      <span className="sr-only">Checking availability...</span>
    </div>
  );
}
