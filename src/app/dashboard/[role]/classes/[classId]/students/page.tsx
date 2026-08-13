import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { ClassDataCenterStudentsTab } from "@/features/classes/class-data-center/class-data-center-students-tab";
import { ClassStudentsTab } from "@/features/teacher/class-workspace/class-students-tab";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class students",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function ClassStudentsPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  if (role === "teacher") {
    return <ClassStudentsTab classId={classId} role={role} />;
  }
  if (!canManageSchoolStructure(role)) notFound();
  return <ClassDataCenterStudentsTab classId={classId} />;
}
