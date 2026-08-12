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

export default async function StudentDocumentsPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();
  const role = roleParam as Role;
  if (!isStudentProfileViewerRole(role)) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Documents</h2>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Labeled files and report card uploads tied to this student record.
        </p>
      </div>
      <FilesTab studentId={studentId} />
      {canUploadReportCards(role) ? (
        <ReportCardsWorkspace
          role={role}
          studentId={studentId}
          intro="Add or replace an official report card PDF for this student."
        />
      ) : null}
    </div>
  );
}
