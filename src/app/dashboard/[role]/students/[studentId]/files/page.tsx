import { notFound } from "next/navigation";

import {
  canUploadReportCards,
  isRole,
  isStudentProfileViewerRole,
  type Role,
} from "@/config/roles";
import { ReportCardsWorkspace } from "@/features/report-cards/report-cards-workspace";
import { FilesTab } from "@/features/students/profile/tabs/files-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentFilesPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();
  const role = roleParam as Role;
  if (!isStudentProfileViewerRole(role)) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium tracking-tight">Files</h2>
      <FilesTab studentId={studentId} />
      {canUploadReportCards(role) ? (
        <ReportCardsWorkspace
          role={role}
          studentId={studentId}
          intro="Upload report card PDFs here. Uploaded files appear in the list above once saved."
        />
      ) : null}
    </div>
  );
}
