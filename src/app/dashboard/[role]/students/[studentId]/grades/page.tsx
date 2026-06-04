import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { GradesTab } from "@/features/students/profile/tabs/grades-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentGradesPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  return <GradesTab studentId={studentId} role={roleParam} />;
}
