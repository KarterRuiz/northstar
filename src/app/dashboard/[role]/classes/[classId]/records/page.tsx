import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
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

export default async function TeacherClassRecordsPage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  const sp = await searchParams;
  const view = parseClassRecordsView(sp.view);

  return <ClassRecordsTab classId={classId} view={view} />;
}
