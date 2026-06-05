import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClassManagementLoading() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full max-w-[8rem]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full lg:w-40" />
            <Skeleton className="h-10 w-full lg:w-40" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
