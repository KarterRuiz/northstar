import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { assertLeadershipDashboardRole } from "@/features/academic-review/assert-leadership-dashboard-role";
import { AcademicReviewWorkspace } from "@/features/academic-review/academic-review-workspace";
import {
  loadAcademicReviewData,
  parseAcademicReviewSearchParams,
} from "@/features/academic-review/load-academic-review-data";

export const metadata: Metadata = {
  title: "Academic review",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AcademicReviewPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  await assertLeadershipDashboardRole(role);

  const rawSp = await searchParams;
  const sp = parseAcademicReviewSearchParams(rawSp);
  const data = await loadAcademicReviewData(sp);

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Academic review</h1>
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
          role="alert"
        >
          {data.message}
        </div>
      </div>
    );
  }

  return <AcademicReviewWorkspace role={role} searchParams={sp} data={data} />;
}
