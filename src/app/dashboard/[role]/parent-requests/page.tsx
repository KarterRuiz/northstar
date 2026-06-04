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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  isParentRequestStatus,
  type ParentRequestStatus,
} from "@/features/parent-requests/constants";
import { loadParentRequestsList } from "@/features/parent-requests/load-parent-requests";
import { ParentRequestsFilters } from "@/features/parent-requests/parent-requests-filters";
import { ParentRequestStatusBadge } from "@/features/parent-requests/parent-request-status-badge";
import { Inbox } from "lucide-react";

export const metadata: Metadata = {
  title: "Parent requests",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{
    status?: string | string[];
    student_q?: string | string[];
  }>;
};

export default async function ParentRequestsPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  if (!canManageParentRecordRequests(role)) {
    notFound();
  }

  const sp = await searchParams;
  const rawStatus = sp.status;
  const statusRaw =
    typeof rawStatus === "string" ? rawStatus : Array.isArray(rawStatus) ? rawStatus[0] : "";
  const statusFilter: ParentRequestStatus | undefined = isParentRequestStatus(statusRaw)
    ? statusRaw
    : undefined;

  const rawQ = sp.student_q;
  const studentSearch =
    typeof rawQ === "string" ? rawQ : Array.isArray(rawQ) ? rawQ[0] : undefined;

  const list = await loadParentRequestsList({
    status: statusFilter,
    studentSearch: studentSearch?.trim() ? studentSearch : undefined,
  });

  const basePath = `/dashboard/${role}/parent-requests`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Parent record requests"
        description="Receive, assign, and complete formal records requests from families. Teachers cannot access this workspace."
        actions={
          <Button asChild>
            <Link href={`${basePath}/new`}>New request</Link>
          </Button>
        }
      />

      <ParentRequestsFilters
        roleBasePath={basePath}
        defaultStatus={statusFilter}
        defaultStudentSearch={studentSearch?.trim()}
      />

      {!list.ok ? (
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {list.message}
        </div>
      ) : list.rows.length === 0 ? (
        <ListEmptyState
          icon={Inbox}
          title="No requests match these filters"
          description={
            <>
              Adjust filters or{" "}
              <Link href={`${basePath}/new`} className="text-primary font-medium underline-offset-4 hover:underline">
                create a request
              </Link>
              .
            </>
          }
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <Table aria-label="Parent record requests">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[10rem]">Student</TableHead>
                <TableHead className="min-w-[9rem]">Requester</TableHead>
                <TableHead className="w-[7rem]">Status</TableHead>
                <TableHead className="min-w-[8rem] text-right">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((row) => {
                const stu = row.student;
                const studentLabel = stu
                  ? stu.preferred_name?.trim() ||
                    [stu.first_name, stu.last_name].filter(Boolean).join(" ").trim() ||
                    "Student"
                  : "Student";

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`${basePath}/${row.id}`}
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {studentLabel}
                      </Link>
                      {stu?.external_id?.trim() ? (
                        <span className="text-muted-foreground block text-xs tabular-nums">
                          #{stu.external_id.trim()}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{row.requester_name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {row.requester_email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ParentRequestStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                      {row.created_at.slice(0, 10)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
