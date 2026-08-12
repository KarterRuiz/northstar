import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherClassWorkspaceLoading() {
  return (
    <div className="ns-page-shell-wide space-y-6">
      <section className="bg-card border-border/80 space-y-5 rounded-xl border p-4 shadow-sm sm:p-6">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full max-w-xl" />
      </section>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[4.75rem] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
