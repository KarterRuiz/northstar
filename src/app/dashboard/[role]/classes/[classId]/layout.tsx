import { notFound } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import {
  ClassDataCenterDenied,
  ClassDataCenterShell,
} from "@/features/classes/class-data-center/class-data-center-shell";
import { loadClassDataCenterContext } from "@/features/classes/class-data-center/load-class-data-center-context";
import { loadClassDataCenterManagementOptions } from "@/features/classes/class-data-center/load-class-data-center-management-options";
import {
  ClassWorkspaceDenied,
  ClassWorkspaceShell,
} from "@/features/teacher/class-workspace/class-workspace-shell";
import { loadTeacherClassContext } from "@/features/teacher/class-workspace/load-teacher-class-context";
import { isUuid } from "@/lib/students/uuid";

export default async function ClassDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string; classId: string }>;
}) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  if (role === "teacher") {
    const ctx = await loadTeacherClassContext(classId);
    if (!ctx.ok) {
      return <ClassWorkspaceDenied message={ctx.message} />;
    }
    return <ClassWorkspaceShell context={ctx.context}>{children}</ClassWorkspaceShell>;
  }

  if (!canManageSchoolStructure(role)) {
    notFound();
  }

  const [ctx, management] = await Promise.all([
    loadClassDataCenterContext(classId),
    loadClassDataCenterManagementOptions(),
  ]);
  if (!ctx.ok) {
    return <ClassDataCenterDenied message={ctx.message} />;
  }

  return (
    <ClassDataCenterShell context={ctx.context} management={management}>
      {children}
    </ClassDataCenterShell>
  );
}
