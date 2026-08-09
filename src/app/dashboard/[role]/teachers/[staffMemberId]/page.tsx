import { notFound, redirect } from "next/navigation";

import { canManageStaffDirectory, isRole } from "@/config/roles";
import { staffProfilePath } from "@/features/admin/staff-directory/staff-directory-path";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; staffMemberId: string }>;
};

export default async function StaffProfileIndexPage({ params }: PageProps) {
  const { role, staffMemberId } = await params;
  if (!isRole(role) || !canManageStaffDirectory(role)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  redirect(staffProfilePath(role, staffMemberId, "overview"));
}
