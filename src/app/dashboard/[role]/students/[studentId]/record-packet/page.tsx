import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  canManageParentRecordRequests,
  isRole,
  type Role,
} from "@/config/roles";
import { siteConfig } from "@/config/site";
import { RecordPacketBody } from "@/features/record-packet/record-packet-body";
import { loadRecordPacketPayload } from "@/features/record-packet/load-record-packet-data";
import { RecordPacketToolbar } from "@/features/record-packet/record-packet-toolbar";
import { recordAuditEvent } from "@/lib/audit";
import { getUser } from "@/lib/auth/session";
import { isStudentId } from "@/lib/students/uuid";

import "@/features/record-packet/record-packet-print.css";

export const metadata: Metadata = {
  title: "Record packet",
};

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentRecordPacketPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  if (!canManageParentRecordRequests(role)) {
    notFound();
  }

  if (!isStudentId(studentId)) {
    notFound();
  }

  const payload = await loadRecordPacketPayload(studentId);

  if (!payload.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Record packet unavailable</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{payload.message}</p>
      </div>
    );
  }

  const user = await getUser();
  await recordAuditEvent({
    action: "student_record_exported",
    metadata: { studentId },
    actorUserId: user?.id,
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6 sm:p-8">
      <header className="print:hidden">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
          {siteConfig.shortName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Student record packet</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Consolidated profile, enrolment, documents metadata, and insight summaries for registrar
          and school leadership. Teachers cannot access this export.
        </p>
      </header>

      <RecordPacketToolbar dashboardRole={role} studentId={studentId} />

      <RecordPacketBody dashboardRole={role} studentId={studentId} data={payload} />
    </div>
  );
}
