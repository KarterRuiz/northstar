import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
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
import { StaffDirectoryTable } from "@/features/admin/staff-directory/staff-directory-table";
import { fetchStaffDirectoryPage } from "@/features/admin/staff-directory/staff-directory-queries";
import { fetchStaffInvitations } from "@/features/admin/staff-directory/staff-invitations-queries";
import { StaffOnboardingSection } from "@/features/admin/staff-directory/staff-onboarding-section";
import { getAdminActor } from "@/lib/auth/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Teachers & staff",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function AdminStaffDirectoryPage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  if (roleParam !== "admin") notFound();

  const supabase = await createServerSupabaseClient();
  const actor = await getAdminActor(supabase);
  if (!actor) notFound();

  const sp = await searchParams;
  const [directory, invitationsResult] = await Promise.all([
    fetchStaffDirectoryPage(sp),
    fetchStaffInvitations(),
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(directory.totalCount / directory.pageSize),
  );
  const page = Math.min(directory.page, totalPages);
  const from = directory.totalCount === 0 ? 0 : (page - 1) * directory.pageSize + 1;
  const to = Math.min(directory.totalCount, page * directory.pageSize);

  const prevHref =
    page > 1
      ? `/dashboard/admin/teachers?page=${page - 1}`
      : null;
  const nextHref =
    page < totalPages
      ? `/dashboard/admin/teachers?page=${page + 1}`
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Staff directory & roles"
        description={
          <>
            Record onboarding invitations, link new Auth users to{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
              profiles
            </code>
            , and manage dashboard roles. Names and emails sync from invitations when staff
            accept or are linked manually.
          </>
        }
        footer={
          <Link
            href="/dashboard/admin"
            className="text-primary font-medium underline-offset-4 transition-colors duration-150 hover:underline"
          >
            Back to admin overview
          </Link>
        }
      />

      <StaffOnboardingSection
        invitations={invitationsResult.rows}
        invitationsError={invitationsResult.error}
      />

      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
          <CardDescription>
            {directory.totalCount === 0
              ? "No rows to show."
              : `Showing ${from}–${to} of ${directory.totalCount} (page ${page} of ${totalPages}).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {directory.error ? (
            <div
              className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
              role="alert"
            >
              <span className="text-foreground font-medium">Could not load directory.</span>{" "}
              {directory.error}
            </div>
          ) : null}

          <StaffDirectoryTable rows={directory.rows} currentUserId={actor.userId} />

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
