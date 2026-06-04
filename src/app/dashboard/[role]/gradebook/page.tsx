import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { TeacherGradebookPickerPageContent } from "@/features/teacher/dashboard/teacher-gradebook-picker-page";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";

export const metadata: Metadata = {
  title: "Gradebook",
  description: "Choose a class to open its gradebook.",
};

type PageProps = {
  params: Promise<{ role: string }>;
};

export default async function TeacherGradebookIndexPage({ params }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();

  const data = await loadTeacherWorkspaceData();
  if (data.ok && data.classes.length === 1) {
    redirect(`/dashboard/teacher/classes/${data.classes[0].id}/gradebook`);
  }

  return <TeacherGradebookPickerPageContent />;
}
