import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { ClassDataCenterStaffTab } from "@/features/classes/class-data-center/class-staff-tab";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class staff",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function ClassStaffPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!canManageSchoolStructure(role)) notFound();
  if (!isUuid(classId)) notFound();

  return <ClassDataCenterStaffTab classId={classId} />;
}
