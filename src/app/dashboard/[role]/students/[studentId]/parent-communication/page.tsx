import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { ParentCommunicationTab } from "@/features/students/profile/tabs/parent-communication-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentParentCommunicationPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  return <ParentCommunicationTab studentId={studentId} role={roleParam} />;
}
