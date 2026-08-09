import { Suspense } from "react";

import { isLeadershipAuditRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { AdminDashboardSkeleton } from "@/features/admin/dashboard/admin-dashboard-skeleton";
import { AdminDashboardStats } from "@/features/admin/dashboard/admin-dashboard-stats";
import { AdminNeedsAttention } from "@/features/admin/dashboard/admin-needs-attention";
import { AdminRecentActivity } from "@/features/admin/dashboard/admin-recent-activity";
import { StaffTodayPanel } from "@/features/admin/dashboard/staff-today-panel";
import { getProfileRole, getUser } from "@/lib/auth/session";

function ActionLayerSkeleton() {
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label="Loading needs attention"
    >
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

/**
 * Admin overview — calm executive command center.
 * Uses NorthStar page shell + Workspace headers; destinations live in the sidebar.
 */
export async function AdminDashboardHome() {
  const user = await getUser();
  const profileRole = user ? await getProfileRole(user.id) : null;
  const role: Role =
    profileRole && isLeadershipAuditRole(profileRole) ? profileRole : "admin";

  return (
    <div className="ns-page-shell">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Overview"
        description="Priorities, metrics, and recent activity."
      />

      <div className="space-y-8 sm:space-y-10">
        <Suspense fallback={<ActionLayerSkeleton />}>
          <AdminNeedsAttention />
        </Suspense>

        <Suspense fallback={<ActionLayerSkeleton />}>
          <StaffTodayPanel role={role} />
        </Suspense>

        <Suspense fallback={<AdminDashboardSkeleton />}>
          <AdminDashboardStats />
        </Suspense>

        <Suspense fallback={null}>
          <AdminRecentActivity />
        </Suspense>
      </div>
    </div>
  );
}
