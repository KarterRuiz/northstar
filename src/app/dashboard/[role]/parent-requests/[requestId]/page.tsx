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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { EditParentRequestForm } from "@/features/parent-requests/edit-parent-request-form";
import { loadProfilesForParentRequestAssignment } from "@/features/parent-requests/load-assignment-profiles";
import { loadParentRequestById } from "@/features/parent-requests/load-parent-requests";
import { ParentRequestStatusBadge } from "@/features/parent-requests/parent-request-status-badge";
import { isStudentId } from "@/lib/students/uuid";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string; requestId: string }>;
}): Promise<Metadata> {
  const { requestId } = await params;
  return {
    title: `Request ${requestId.slice(0, 8)}…`,
  };
}

type PageProps = {
  params: Promise<{ role: string; requestId: string }>;
};

export default async function ParentRequestDetailPage({ params }: PageProps) {
  const { role: roleParam, requestId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  if (!canManageParentRecordRequests(role)) {
    notFound();
  }

  const loaded = await loadParentRequestById(requestId);
  if (!loaded.ok) {
    notFound();
  }

  const assignees = await loadProfilesForParentRequestAssignment();
  const profiles = assignees.ok ? assignees.profiles : [];

  const row = loaded.row;
  const studentHref =
    row.student_id && isStudentId(row.student_id)
      ? `/dashboard/${role}/students/${row.student_id}/report-cards`
      : `/dashboard/${role}/students`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Parent record request"
        description={
          <>
            Submitted <span className="tabular-nums">{row.created_at.slice(0, 10)}</span>
            <span className="text-muted-foreground"> · </span>
            Updated <span className="tabular-nums">{row.updated_at.slice(0, 10)}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ParentRequestStatusBadge status={row.status} />
            <Button variant="outline" asChild>
              <Link href={`/dashboard/${role}/parent-requests`}>All requests</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={studentHref}>Student profile</Link>
            </Button>
            {row.student_id && isStudentId(row.student_id) ? (
              <Button asChild>
                <Link
                  href={`/dashboard/${role}/students/${row.student_id}/record-packet`}
                >
                  Generate record packet
                </Link>
              </Button>
            ) : null}
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Identifiers</CardTitle>
          <CardDescription className="font-mono text-xs break-all">
            {row.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Link this request when corresponding with the family; packet exports include request
          history for the learner.
        </CardContent>
      </Card>

      <EditParentRequestForm
        dashboardRole={role}
        row={row}
        assignees={profiles}
        handler={loaded.handler}
      />
    </div>
  );
}
