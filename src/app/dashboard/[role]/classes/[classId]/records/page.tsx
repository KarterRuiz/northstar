import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canManageSchoolStructure, isRole, type Role } from "@/config/roles";
import { ClassDataCenterRecordsTab } from "@/features/classes/class-data-center/class-records-tab";
import { parseClassRecordsView } from "@/features/teacher/class-workspace/class-records";
import { ClassRecordsTab } from "@/features/teacher/class-workspace/class-records-tab";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class records",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassRecordsPage({ params, searchParams }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (!isUuid(classId)) notFound();

  const sp = await searchParams;
  const view = parseClassRecordsView(sp.view);

  if (role === "teacher") {
    return <ClassRecordsTab classId={classId} view={view} />;
  }
  if (!canManageSchoolStructure(role)) notFound();
  return <ClassDataCenterRecordsTab classId={classId} view={view} />;
}
