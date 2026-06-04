import { notFound } from "next/navigation";

import {
  canUploadReportCards,
  isRole,
  isStudentProfileViewerRole,
  type Role,
} from "@/config/roles";
import { ReportCardsWorkspace } from "@/features/report-cards/report-cards-workspace";
import { ReportCardsTab } from "@/features/students/profile/tabs/report-cards-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentReportCardsPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();
  const role = roleParam as Role;
  if (!isStudentProfileViewerRole(role)) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium tracking-tight">Report cards</h2>
      <ReportCardsTab studentId={studentId} dashboardRole={role} />
      {canUploadReportCards(role) ? (
        <ReportCardsWorkspace role={role} studentId={studentId} />
      ) : null}
    </div>
  );
}
