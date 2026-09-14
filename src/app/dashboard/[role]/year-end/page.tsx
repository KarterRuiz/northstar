import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { loadYearEndWorkspace } from "@/features/year-end/load-year-end-workspace";
import { assertYearEndDashboardRole } from "@/features/year-end/require-year-end-actor";
import { YearEndWorkspace } from "@/features/year-end/year-end-workspace";

export const metadata: Metadata = {
  title: "Year-End",
  description: "Plan next-year classes and student dispositions (preview only).",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function YearEndPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  await assertYearEndDashboardRole(role);

  const raw = await searchParams;
  const data = await loadYearEndWorkspace(role, raw);

  if (!data.ok) {
    return (
      <div className="ns-page-shell space-y-6">
        <h1 className="ns-section-title">Year-End</h1>
        <div
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {data.message}
        </div>
      </div>
    );
  }

  return <YearEndWorkspace role={role} data={data} />;
}
