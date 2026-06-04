import { siteConfig } from "@/config/site";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CARD_IDS = [
  "total-students",
  "active-classes",
  "pending-transition-notes",
  "missing-report-cards",
  "recent-record-requests",
] as const;

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <section aria-busy="true" aria-label="Loading summary metrics">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <h2 className="sr-only">Summary metrics</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARD_IDS.map((id) => (
            <Card key={id}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          Loading live metrics from {siteConfig.shortName}…
        </p>
      </section>

      <div className="border-border rounded-xl border p-5 sm:p-6">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-28 w-full rounded-md" />
      </div>
    </div>
  );
}
