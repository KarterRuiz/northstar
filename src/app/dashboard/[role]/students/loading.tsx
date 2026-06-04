import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsDirectoryLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-44 sm:h-9" />
          <Skeleton className="h-12 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
