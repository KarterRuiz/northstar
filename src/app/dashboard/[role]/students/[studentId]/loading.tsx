import { Skeleton } from "@/components/ui/skeleton";

export default function StudentProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-16 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
