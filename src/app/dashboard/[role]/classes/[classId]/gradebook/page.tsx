import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { classDataCenterPath } from "@/features/classes/class-data-center/constants";
import { TeacherGradebookPageContent } from "@/features/teacher/gradebook/gradebook-page";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Gradebook",
  description: "Class gradebook categories, assignments, and scores.",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function ClassGradebookRoute({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  if (role === "teacher") {
    return <TeacherGradebookPageContent classId={classId} embedded />;
  }
  if (canManageSchoolStructure(role)) {
    redirect(classDataCenterPath(role, classId, "academics"));
  }
  notFound();
}
