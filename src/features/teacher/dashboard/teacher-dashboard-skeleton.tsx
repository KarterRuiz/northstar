import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TeacherDashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6 sm:p-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card className="h-full">
                <CardHeader className="space-y-2 pb-2">
                  <Skeleton className="h-5 w-[min(220px,85%)]" />
                  <Skeleton className="h-4 w-[min(120px,50%)]" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
