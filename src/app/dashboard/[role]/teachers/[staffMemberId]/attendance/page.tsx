import { notFound } from "next/navigation";

import { canManageStaffDirectory, isRole } from "@/config/roles";
import { loadStaffLeadershipMetrics } from "@/features/staff-profile/load-staff-leadership-metrics";
import { loadStaffMemberProfile } from "@/features/staff-profile/load-staff-profile";
import { StaffAttendanceTab } from "@/features/staff-profile/tabs/attendance-tab";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; staffMemberId: string }>;
};

export default async function StaffAttendancePage({ params }: PageProps) {
  const { role, staffMemberId } = await params;
  if (!isRole(role) || !canManageStaffDirectory(role)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  const profileLoad = await loadStaffMemberProfile(staffMemberId);
  if (profileLoad.kind !== "ok") notFound();

  const metrics = await loadStaffLeadershipMetrics(
    staffMemberId,
    profileLoad.member,
    role,
  );

  return (
    <StaffAttendanceTab
      classAttendance={metrics.classAttendance}
      compliance={metrics.attendanceCompliance}
    />
  );
}
