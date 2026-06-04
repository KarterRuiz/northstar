import { notFound } from "next/navigation";

import { isLeadershipAuditRole, isRole, type Role } from "@/config/roles";
import { AuditHistoryTab } from "@/features/students/profile/tabs/audit-history-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentAuditHistoryPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();
  const role = roleParam as Role;
  if (!isLeadershipAuditRole(role)) notFound();

  return <AuditHistoryTab studentId={studentId} viewerRole={role} />;
}
