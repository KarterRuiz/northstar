import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { TeacherGradebookPageContent } from "@/features/teacher/gradebook/gradebook-page";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Gradebook",
  description: "Class gradebook categories, assignments, and scores.",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function TeacherGradebookRoute({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  return <TeacherGradebookPageContent classId={classId} />;
}
