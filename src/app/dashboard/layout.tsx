import type { Metadata } from "next";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getDashboardAccessContext } from "@/lib/auth/assert-dashboard-role";
import { syncPendingStaffInvitationProfile } from "@/lib/staff/sync-staff-invitation-profile";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await syncPendingStaffInvitationProfile();
  const { switcherRoles } = await getDashboardAccessContext();
  return (
    <DashboardShell switcherRoles={[...switcherRoles]}>{children}</DashboardShell>
  );
}
