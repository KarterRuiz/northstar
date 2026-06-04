import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { BehaviorTab } from "@/features/students/profile/tabs/behavior-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentBehaviorPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  return <BehaviorTab studentId={studentId} role={roleParam} />;
}
