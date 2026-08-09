import { notFound, redirect } from "next/navigation";

import { isRole } from "@/config/roles";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

/** Preserves bookmarks: files renamed to Documents in the profile shell. */
export default async function StudentFilesRedirectPage({ params }: PageProps) {
  const { role, studentId } = await params;
  if (!isRole(role)) notFound();
  if (!isStudentId(studentId)) notFound();

  redirect(`/dashboard/${role}/students/${studentId}/documents`);
}
