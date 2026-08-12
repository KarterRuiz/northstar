import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading shell matching Admin Home hierarchy:
 * Brief + Calendar → Quick Access → School Pulse.
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true" aria-label="Loading home">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-5">
        <div className="space-y-2.5 lg:col-span-3">
          <Skeleton className="h-5 w-28" />
          <Card className="min-h-[10rem] p-3.5 sm:p-4">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-48" />
            <Skeleton className="mt-2 h-3.5 w-36" />
          </Card>
        </div>
        <div className="space-y-2.5 lg:col-span-2">
          <Skeleton className="h-5 w-20" />
          <Card className="min-h-[10rem] p-3.5 sm:p-4">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-2 h-4 w-36" />
            <Skeleton className="mt-4 h-16 w-full rounded-lg" />
          </Card>
        </div>
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-5 w-28" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} variant="metric" className="min-h-[5.25rem]">
              <CardHeader density="metric" className="pb-1">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent density="metric">
                <Skeleton className="h-3.5 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-5 w-24" />
        <div className="border-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card space-y-2 px-3 py-2.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
