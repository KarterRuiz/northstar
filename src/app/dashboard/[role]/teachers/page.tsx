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
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { loadActiveClassesForStaffInvite } from "@/features/admin/staff-directory/load-classes-for-staff-invite";
import { StaffDirectoryTable } from "@/features/admin/staff-directory/staff-directory-table";
import {
  fetchClassAssignmentsForTeachers,
  fetchStaffDirectoryPage,
} from "@/features/admin/staff-directory/staff-directory-queries";
import { fetchStaffInvitations } from "@/features/admin/staff-directory/staff-invitations-queries";
import { StaffOnboardingSection } from "@/features/admin/staff-directory/staff-onboarding-section";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
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
  next: { page: number; q: string; role: Role | ""; status: "all" | "active" | "inactive" },
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

export default async function StaffDirectoryPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam) || !canManageStaffDirectory(roleParam)) notFound();

  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) notFound();

  const sp = await searchParams;
  const [directory, invitationsResult, classOptions] = await Promise.all([
    fetchStaffDirectoryPage(sp),
    fetchStaffInvitations(),
    loadActiveClassesForStaffInvite(),
  ]);

  let loginBaseUrl: string;
  try {
    loginBaseUrl = getAuthEmailRedirectToLogin();
  } catch {
    loginBaseUrl = "http://localhost:3000/login";
  }

  const totalPages = Math.max(
    1,
    Math.ceil(directory.totalCount / directory.pageSize),
  );
  const page = Math.min(directory.page, totalPages);
  const from = directory.totalCount === 0 ? 0 : (page - 1) * directory.pageSize + 1;
  const to = Math.min(directory.totalCount, page * directory.pageSize);

  const teacherIdsOnPage = directory.rows.filter((r) => r.role === "teacher").map((r) => r.id);
  const assignmentsByTeacher = await fetchClassAssignmentsForTeachers(teacherIdsOnPage);

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
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Teachers & staff"
        description={
          <>
            Search staff, manage roles and access, invite new colleagues, and assign teachers to
            classes. Your role:{" "}
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

      <StaffOnboardingSection
        invitations={invitationsResult.rows}
        invitationsError={invitationsResult.error}
        classOptions={classOptions}
        loginBaseUrl={loginBaseUrl}
      />

      <Card>
        <CardHeader>
          <CardTitle>Staff directory</CardTitle>
          <CardDescription>
            {directory.totalCount === 0
              ? "No profiles match these filters."
              : `Showing ${from}–${to} of ${directory.totalCount} (page ${page} of ${totalPages}).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="GET" className="flex flex-col gap-3 border-b pb-4 md:flex-row md:flex-wrap md:items-end">
            <div className="grid w-full gap-3 sm:grid-cols-2 md:max-w-xl md:flex-1">
              <div className="space-y-1.5">
                <Label htmlFor="staff-filter-q">Search name or email</Label>
                <Input
                  id="staff-filter-q"
                  name="q"
                  defaultValue={directory.filters.q}
                  placeholder="Name or email"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-filter-role">Role</Label>
                <select
                  id="staff-filter-role"
                  name="role"
                  defaultValue={directory.filters.role || ""}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="">All roles</option>
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end md:w-auto">
              <div className="space-y-1.5 sm:min-w-[10rem]">
                <Label htmlFor="staff-filter-status">Access status</Label>
                <select
                  id="staff-filter-status"
                  name="status"
                  defaultValue={directory.filters.status}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  Apply filters
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={staffDirectoryPath(roleParam)}>Reset</Link>
                </Button>
              </div>
            </div>
          </form>

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
            currentUserId={actor.userId}
            assignmentsByTeacher={assignmentsByTeacher}
            availableClasses={classOptions}
          />

          {directory.totalCount > directory.pageSize ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <p className="text-muted-foreground text-xs">
                {directory.pageSize} profiles per page
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
