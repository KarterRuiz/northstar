import { notFound } from "next/navigation";

import { canManageStaffDirectory, isRole } from "@/config/roles";
import { loadStaffActivity } from "@/features/staff-profile/load-staff-activity";
import { loadStaffMemberProfile } from "@/features/staff-profile/load-staff-profile";
import { StaffFilesActivityTab } from "@/features/staff-profile/tabs/files-activity-tab";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; staffMemberId: string }>;
};

export default async function StaffFilesActivityPage({ params }: PageProps) {
  const { role, staffMemberId } = await params;
  if (!isRole(role) || !canManageStaffDirectory(role)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  const profileLoad = await loadStaffMemberProfile(staffMemberId);
  if (profileLoad.kind !== "ok") notFound();

  const activity = await loadStaffActivity(
    staffMemberId,
    profileLoad.member.profile_id,
  );

  return (
    <StaffFilesActivityTab items={activity.items} error={activity.error} />
  );
}
