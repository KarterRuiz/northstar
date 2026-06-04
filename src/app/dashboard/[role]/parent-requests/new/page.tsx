import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  canManageParentRecordRequests,
  isRole,
  type Role,
} from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { CreateParentRequestForm } from "@/features/parent-requests/create-parent-request-form";
import { loadProfilesForParentRequestAssignment } from "@/features/parent-requests/load-assignment-profiles";
import { loadStudentQuickLabelForRequestForm } from "@/features/parent-requests/load-parent-requests";
import { isStudentId } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "New parent request",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ studentId?: string | string[] }>;
};

export default async function NewParentRequestPage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  if (!canManageParentRecordRequests(role)) {
    notFound();
  }

  const sp = await searchParams;
  const rawSid = sp.studentId;
  const studentIdRaw =
    typeof rawSid === "string" ? rawSid : Array.isArray(rawSid) ? rawSid[0] : undefined;
  const initialStudentId =
    studentIdRaw && isStudentId(studentIdRaw) ? studentIdRaw : undefined;

  const assignees = await loadProfilesForParentRequestAssignment();
  const profiles = assignees.ok ? assignees.profiles : [];

  const initialStudentLabel = initialStudentId
    ? await loadStudentQuickLabelForRequestForm(initialStudentId)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="New parent record request"
        description="Search the roster, capture what was requested, and optionally assign a handler."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/dashboard/${role}/parent-requests`}>Back to list</Link>
          </Button>
        }
      />

      {!assignees.ok ? (
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {assignees.message}
        </div>
      ) : null}

      <CreateParentRequestForm
        dashboardRole={role}
        assignees={profiles}
        initialStudentId={initialStudentId}
        initialStudentLabel={initialStudentLabel ?? undefined}
      />
    </div>
  );
}
