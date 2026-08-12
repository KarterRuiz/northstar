import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageStaffDirectory, isRole, roleLabels, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DirectoryToolbar,
  DirectoryToolbarFilters,
  DirectoryToolbarSearch,
} from "@/components/workspace/directory-toolbar";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { AddStaffSheet } from "@/features/admin/staff-directory/add-staff-sheet";
import { loadStaffInviteAccessOptions } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import { SendInvitationsDialog } from "@/features/admin/staff-directory/send-invitations-dialog";
import { StaffDirectoryTable } from "@/features/admin/staff-directory/staff-directory-table";
import { StaffDirectorySummaryStrip } from "@/features/admin/staff-directory/staff-directory-summary";
import {
  fetchClassAssignmentsForStaffMembers,
  fetchGradeAccessForStaffMembers,
  fetchStaffDirectoryPage,
  fetchStaffDirectorySummary,
  fetchStaffInviteCandidates,
} from "@/features/admin/staff-directory/staff-directory-queries";
import { fetchStaffDeletabilityMap } from "@/features/admin/staff-directory/staff-lifecycle";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import type { StaffRosterDisplayStatus } from "@/lib/staff/staff-roster-status";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { getAuthEmailRedirectToLogin } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Teachers & staff",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    role?: string | string[];
    status?: string | string[];
  }>;
};

function staffTeachersHref(
  role: Role,
  next: {
    page: number;
    q: string;
    role: Role | "";
    status: "all" | StaffRosterDisplayStatus;
  },
): string {
  const sp = new URLSearchParams();
  if (next.page > 1) sp.set("page", String(next.page));
  if (next.q.trim()) sp.set("q", next.q.trim());
  if (next.role) sp.set("role", next.role);
  if (next.status !== "all") sp.set("status", next.status);
  const qs = sp.toString();
  const base = staffDirectoryPath(role);
  return qs ? `${base}?${qs}` : base;
}

const selectClassName =
  "border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

const STATUS_FILTER_OPTIONS: { value: "all" | StaffRosterDisplayStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready to invite" },
  { value: "invitation_sent", label: "Invited" },
  { value: "opened", label: "Invited · opened" },
  { value: "account_exists", label: "Setup needed" },
  { value: "accepted", label: "Setup needed" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "archived", label: "Archived" },
];

export default async function StaffDirectoryPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam) || !canManageStaffDirectory(roleParam)) notFound();

  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) notFound();

  const sp = await searchParams;
  const [directory, summary, accessOptions, inviteCandidates] = await Promise.all([
    fetchStaffDirectoryPage(sp),
    fetchStaffDirectorySummary(),
    loadStaffInviteAccessOptions(),
    fetchStaffInviteCandidates(),
  ]);
  const { grades: gradeOptions, classes: classOptions } = accessOptions;

  const loginBaseUrl = getAuthEmailRedirectToLogin();

  const totalPages = Math.max(1, Math.ceil(directory.totalCount / directory.pageSize));
  const page = Math.min(directory.page, totalPages);
  const from = directory.totalCount === 0 ? 0 : (page - 1) * directory.pageSize + 1;
  const to = Math.min(directory.totalCount, page * directory.pageSize);

  const memberIdsOnPage = directory.rows.map((r) => r.id);
  const candidateIds = inviteCandidates.map((c) => c.id);
  const accessIds = [...new Set([...memberIdsOnPage, ...candidateIds])];

  const profileIdsForDelete = directory.rows
    .filter((r) => r.displayStatus === "disabled" && r.profile_id)
    .map((r) => r.profile_id!) ;

  const [assignmentsByMember, gradesByMember, deletableMap] = await Promise.all([
    fetchClassAssignmentsForStaffMembers(accessIds),
    fetchGradeAccessForStaffMembers(accessIds),
    fetchStaffDeletabilityMap(supabase, profileIdsForDelete),
  ]);

  const deletableByStaffMemberId: Record<string, boolean> = {};
  for (const row of directory.rows) {
    if (!row.profile_id) {
      deletableByStaffMemberId[row.id] = true;
    } else if (row.displayStatus === "disabled") {
      deletableByStaffMemberId[row.id] = deletableMap.get(row.profile_id) ?? false;
    } else {
      deletableByStaffMemberId[row.id] = false;
    }
  }

  const prevHref =
    page > 1
      ? staffTeachersHref(roleParam, {
          page: page - 1,
          q: directory.filters.q,
          role: directory.filters.role,
          status: directory.filters.status,
        })
      : null;
  const nextHref =
    page < totalPages
      ? staffTeachersHref(roleParam, {
          page: page + 1,
          q: directory.filters.q,
          role: directory.filters.role,
          status: directory.filters.status,
        })
      : null;

  const overviewHref = `/dashboard/${roleParam}`;

  return (
    <div className="ns-page-shell-wide">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Teachers & staff"
        description={
          <>
            Build the school roster first, then invite people to activate access. Your role:{" "}
            <span className="text-foreground font-medium">{roleLabels[roleParam]}</span>.
          </>
        }
        footer={
          <Link
            href={overviewHref}
            className="text-primary font-medium underline-offset-4 transition-colors duration-150 hover:underline"
          >
            Back to overview
          </Link>
        }
      />

      <Card>
        <CardHeader density="compact" className="space-y-3 pb-3 sm:pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Staff directory</CardTitle>
              <CardDescription>
                {directory.totalCount === 0
                  ? "No staff match these filters."
                  : `Showing ${from}–${to} of ${directory.totalCount}`}
              </CardDescription>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:items-end">
              <StaffDirectorySummaryStrip summary={summary} />
              <div className="flex flex-wrap gap-2">
                <SendInvitationsDialog
                  candidates={inviteCandidates}
                  gradesByMember={gradesByMember}
                  classesByMember={assignmentsByMember}
                  gradeOptions={gradeOptions}
                />
                <AddStaffSheet gradeOptions={gradeOptions} classOptions={classOptions} />
              </div>
            </div>
          </div>
          <form method="GET">
            <DirectoryToolbar className="border-0 pb-0">
              <DirectoryToolbarSearch>
                <Label htmlFor="staff-filter-q" className="sr-only">
                  Search name or email
                </Label>
                <Input
                  id="staff-filter-q"
                  name="q"
                  defaultValue={directory.filters.q}
                  placeholder="Search name or email…"
                  autoComplete="off"
                />
              </DirectoryToolbarSearch>
              <DirectoryToolbarFilters>
                <div className="w-full sm:w-36">
                  <Label htmlFor="staff-filter-role" className="sr-only">
                    Role
                  </Label>
                  <select
                    id="staff-filter-role"
                    name="role"
                    defaultValue={directory.filters.role || ""}
                    className={selectClassName}
                    aria-label="Filter by role"
                  >
                    <option value="">All roles</option>
                    {(Object.keys(roleLabels) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {roleLabels[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-44">
                  <Label htmlFor="staff-filter-status" className="sr-only">
                    Invitation status
                  </Label>
                  <select
                    id="staff-filter-status"
                    name="status"
                    defaultValue={directory.filters.status}
                    className={selectClassName}
                    aria-label="Filter by invitation status"
                  >
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm">
                  Apply
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={staffDirectoryPath(roleParam)}>Reset</Link>
                </Button>
              </DirectoryToolbarFilters>
            </DirectoryToolbar>
          </form>
        </CardHeader>
        <CardContent density="compact" className="space-y-4">
          {directory.error ? (
            <div
              className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
              role="alert"
            >
              <span className="text-foreground font-medium">Could not load directory.</span>{" "}
              {directory.error}
            </div>
          ) : null}

          <StaffDirectoryTable
            rows={directory.rows}
            role={actor.role}
            currentUserId={actor.userId}
            assignmentsByMember={assignmentsByMember}
            gradesByMember={gradesByMember}
            availableGrades={gradeOptions}
            availableClasses={classOptions}
            deletableByStaffMemberId={deletableByStaffMemberId}
            loginBaseUrl={loginBaseUrl}
          />

          {directory.totalCount > directory.pageSize ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="ns-meta">
                Page {page} of {totalPages} · {directory.pageSize} per page
              </p>
              <div className="flex gap-2">
                {prevHref ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={prevHref}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                )}
                {nextHref ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={nextHref}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
