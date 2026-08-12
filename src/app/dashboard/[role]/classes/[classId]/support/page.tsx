import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { ClassSupportTab } from "@/features/teacher/class-workspace/class-support-tab";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class support",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function TeacherClassSupportPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  return <ClassSupportTab classId={classId} />;
}
