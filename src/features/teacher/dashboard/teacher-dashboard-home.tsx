import { Suspense } from "react";

import { TeacherDashboardSkeleton } from "@/features/teacher/dashboard/teacher-dashboard-skeleton";
import { TeacherDashboardView } from "@/features/teacher/dashboard/teacher-dashboard-view";

export function TeacherDashboardHome() {
  return (
    <Suspense fallback={<TeacherDashboardSkeleton />}>
      <TeacherDashboardView />
    </Suspense>
  );
}
