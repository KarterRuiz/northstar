import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { OverviewTab } from "@/features/students/profile/tabs/overview-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentOverviewPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  return <OverviewTab studentId={studentId} role={roleParam} />;
}
