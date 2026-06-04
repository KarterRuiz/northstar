import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { TeacherClassDetailPageContent } from "@/features/teacher/dashboard/teacher-class-detail-page";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Class roster",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function TeacherClassDetailRoute({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  return <TeacherClassDetailPageContent classId={classId} />;
}
