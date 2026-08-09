import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SIGNAL_IDS = [
  "student-enrollment",
  "active-classes",
  "transition-notes",
  "report-cards",
  "parent-requests",
] as const;

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section aria-busy="true" aria-label="Loading operational signals">
        <div className="mb-3 space-y-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-44" />
        </div>
        <h2 className="sr-only">Operational signals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNAL_IDS.map((id) => (
            <Card key={id} variant="metric">
              <CardHeader density="metric" className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent density="metric">
                <Skeleton className="h-7 w-14" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-busy="true" aria-label="Loading attendance">
        <div className="mb-3 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
      </section>
    </div>
  );
}
