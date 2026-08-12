import { notFound } from "next/navigation";

import { canAccessFollowUp, canManageStaffDirectory, isRole } from "@/config/roles";
import { loadOpenFollowUpsForStaff } from "@/features/follow-up/load-follow-up-workspace";
import { loadStaffActivity } from "@/features/staff-profile/load-staff-activity";
import { loadStaffLeadershipMetrics } from "@/features/staff-profile/load-staff-leadership-metrics";
import { loadStaffMemberProfile } from "@/features/staff-profile/load-staff-profile";
import { StaffOverviewTab } from "@/features/staff-profile/tabs/overview-tab";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; staffMemberId: string }>;
};

export default async function StaffOverviewPage({ params }: PageProps) {
  const { role, staffMemberId } = await params;
  if (!isRole(role) || !canManageStaffDirectory(role)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  const profileLoad = await loadStaffMemberProfile(staffMemberId);
  if (profileLoad.kind !== "ok") notFound();

  const [metrics, activity, openFollowUps] = await Promise.all([
    loadStaffLeadershipMetrics(staffMemberId, profileLoad.member, role),
    loadStaffActivity(staffMemberId, profileLoad.member.profile_id),
    canAccessFollowUp(role)
      ? loadOpenFollowUpsForStaff(role, staffMemberId)
      : Promise.resolve([]),
  ]);

  return (
    <StaffOverviewTab
      member={profileLoad.member}
      metrics={metrics}
      recentActivity={activity.items}
      viewerRole={role}
      openFollowUps={openFollowUps}
    />
  );
}
