import { Suspense } from "react";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { AdminDashboardSkeleton } from "@/features/admin/dashboard/admin-dashboard-skeleton";
import { AdminDashboardStats } from "@/features/admin/dashboard/admin-dashboard-stats";

const linkClass =
  "text-primary font-medium underline-offset-4 transition-colors duration-150 hover:underline";

export function AdminDashboardHome() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Admin overview"
        description={
          <>
            Live operations snapshot from your Supabase project. Summary metrics
            and recent activity respect row-level security for your organization.
          </>
        }
        footer={
          <span className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <Link href="/dashboard/admin/academic-review" className={linkClass}>
              Academic review
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <Link href="/dashboard/admin/attendance" className={linkClass}>
              Attendance monitoring
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <Link href="/dashboard/admin/school-settings#academic-structure" className={linkClass}>
              Academic structure (years & grades)
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <Link href="/dashboard/admin/classes" className={linkClass}>
              Classes & teacher assignments
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <Link href="/dashboard/admin/teachers" className={linkClass}>
              Staff directory & roles
            </Link>
            <span className="text-muted-foreground/60" aria-hidden>
              ·
            </span>
            <Link
              href="/dashboard/admin/students/f47ac10b-58cc-4372-a567-0e02b2c3d479/report-cards"
              className={linkClass}
            >
              Sample student profile (report cards)
            </Link>
          </span>
        }
      />

      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboardStats />
      </Suspense>
    </div>
  );
}
