import { notFound } from "next/navigation";

import { canManageStaffDirectory, isRole } from "@/config/roles";
import { loadStaffInviteAccessOptions } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import { loadStaffLeadershipMetrics } from "@/features/staff-profile/load-staff-leadership-metrics";
import { loadStaffMemberProfile } from "@/features/staff-profile/load-staff-profile";
import { StaffClassesAcademicsTab } from "@/features/staff-profile/tabs/classes-academics-tab";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; staffMemberId: string }>;
};

export default async function StaffClassesPage({ params }: PageProps) {
  const { role, staffMemberId } = await params;
  if (!isRole(role) || !canManageStaffDirectory(role)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  const profileLoad = await loadStaffMemberProfile(staffMemberId);
  if (profileLoad.kind !== "ok") notFound();

  const [metrics, accessOptions] = await Promise.all([
    loadStaffLeadershipMetrics(staffMemberId, profileLoad.member, role),
    loadStaffInviteAccessOptions(),
  ]);

  return (
    <StaffClassesAcademicsTab
      staffMemberId={staffMemberId}
      staffName={profileLoad.member.full_name}
      role={profileLoad.member.role}
      grades={metrics.grades}
      classes={metrics.classes}
      classAcademics={metrics.classAcademics}
      availableGrades={accessOptions.grades}
      availableClasses={accessOptions.classes}
    />
  );
}
