import { notFound, redirect } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { classDataCenterPath } from "@/features/classes/class-data-center/constants";
import { classWorkspacePath } from "@/features/teacher/class-workspace/constants";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function ClassIndexPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  if (role === "teacher") {
    redirect(classWorkspacePath(classId, "overview"));
  }
  if (!canManageSchoolStructure(role)) notFound();
  redirect(classDataCenterPath(role, classId, "overview"));
}
