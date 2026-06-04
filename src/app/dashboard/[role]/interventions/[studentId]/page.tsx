import { redirect, notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentInterventionDetailPage({ params }: PageProps) {
  const { role, studentId } = await params;
  if (!isRole(role)) notFound();
  if (!isStudentId(studentId)) notFound();

  redirect(`/dashboard/${role}/students/${studentId}/interventions`);
}
