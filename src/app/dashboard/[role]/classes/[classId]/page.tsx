import { notFound, redirect } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { classWorkspacePath } from "@/features/teacher/class-workspace/constants";
import { isUuid } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function TeacherClassIndexPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  redirect(classWorkspacePath(classId, "overview"));
}
