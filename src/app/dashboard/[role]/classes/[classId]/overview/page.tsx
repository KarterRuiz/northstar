import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { ClassDataCenterOverviewTab } from "@/features/classes/class-data-center/class-overview-tab";
import { ClassOverviewTab } from "@/features/teacher/class-workspace/class-overview-tab";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class overview",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function ClassOverviewPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  if (role === "teacher") {
    return <ClassOverviewTab classId={classId} />;
  }
  if (!canManageSchoolStructure(role)) notFound();
  return <ClassDataCenterOverviewTab classId={classId} />;
}
