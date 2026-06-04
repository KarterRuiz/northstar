import { Skeleton } from "@/components/ui/skeleton";

/** Gradebook shell while RSC data loads — matches sticky header + grid proportions. */
export function GradebookSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[100rem] p-6 sm:p-8">
      <header className="space-y-3 border-b pb-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-48" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </header>
      <Skeleton className="mt-4 h-9 w-full max-w-xl" />
      <div className="border-border/80 mt-4 overflow-hidden rounded-lg border">
        <div className="flex border-b">
          <Skeleton className="h-10 w-[9.5rem] shrink-0 rounded-none" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-[5.25rem] shrink-0 rounded-none" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="flex border-b last:border-0">
            <Skeleton className="h-9 w-[9.5rem] shrink-0 rounded-none" />
            {Array.from({ length: 8 }).map((_, col) => (
              <Skeleton key={col} className="h-9 w-[5.25rem] shrink-0 rounded-none" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
