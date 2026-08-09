import { notFound } from "next/navigation";

import { canManageStaffDirectory, isRole } from "@/config/roles";
import { StaffProfessionalNotesTab } from "@/features/staff-profile/tabs/professional-notes-tab";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; staffMemberId: string }>;
};

export default async function StaffProfessionalNotesPage({ params }: PageProps) {
  const { role, staffMemberId } = await params;
  if (!isRole(role) || !canManageStaffDirectory(role)) notFound();
  if (!isUuid(staffMemberId)) notFound();

  return <StaffProfessionalNotesTab />;
}
