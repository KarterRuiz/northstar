import { notFound, redirect } from "next/navigation";

import { isRole } from "@/config/roles";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

/** Preserves bookmarks: grades moved under the Academics tab. */
export default async function StudentGradesRedirectPage({ params }: PageProps) {
  const { role, studentId } = await params;
  if (!isRole(role)) notFound();
  if (!isStudentId(studentId)) notFound();

  redirect(`/dashboard/${role}/students/${studentId}/academics`);
}
