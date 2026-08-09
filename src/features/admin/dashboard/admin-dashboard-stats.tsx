import { AdminAttendanceOverview } from "./admin-attendance-overview";
import { AdminOperationalSignals } from "./admin-operational-signals";
import { AdminRecentParentRequests } from "./admin-recent-parent-requests";
import { getAdminDashboardStats } from "./load-admin-dashboard-stats";

/**
 * Metric / signal body for Admin Overview.
 * Composes operational signals, attendance, and parent-request inbox.
 */
export async function AdminDashboardStats() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-8 sm:space-y-10">
      <AdminOperationalSignals stats={stats} />
      <AdminAttendanceOverview />
      <AdminRecentParentRequests requests={stats.recentParentRequests} />
    </div>
  );
}
