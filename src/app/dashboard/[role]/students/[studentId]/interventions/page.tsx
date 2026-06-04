import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { InterventionsTab } from "@/features/students/profile/tabs/interventions-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentInterventionsPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  return <InterventionsTab studentId={studentId} role={roleParam} />;
}
