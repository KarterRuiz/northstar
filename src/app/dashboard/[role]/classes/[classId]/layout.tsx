import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import {
  ClassWorkspaceDenied,
  ClassWorkspaceShell,
} from "@/features/teacher/class-workspace/class-workspace-shell";
import { loadTeacherClassContext } from "@/features/teacher/class-workspace/load-teacher-class-context";
import { isUuid } from "@/lib/students/uuid";

export default async function TeacherClassWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string; classId: string }>;
}) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  const ctx = await loadTeacherClassContext(classId);
  if (!ctx.ok) {
    return <ClassWorkspaceDenied message={ctx.message} />;
  }

  return <ClassWorkspaceShell context={ctx.context}>{children}</ClassWorkspaceShell>;
}
