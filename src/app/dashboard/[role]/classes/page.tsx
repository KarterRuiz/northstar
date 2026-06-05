import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { canManageSchoolStructure, isRole, roleLabels, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { ClassManagementForms } from "@/features/classes/class-management-forms";
import { loadClassManagementPageData } from "@/features/classes/load-class-management-data";
import { TeacherClassesPageContent } from "@/features/teacher/dashboard/teacher-classes-page";

import ClassManagementLoading from "./loading";

export const metadata: Metadata = {
  title: "Classes",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function ClassManagementBody({
  role,
  searchParams,
}: {
  role: Role;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const data = await loadClassManagementPageData(searchParams);

  if (!data.ok) {
    return (
      <div
        className="bg-destructive/10 text-destructive rounded-lg border border-destructive/30 px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load class data.</span> {data.message}
      </div>
    );
  }

  return (
    <ClassManagementForms
      dashboardRole={role}
      schoolYears={data.schoolYears}
      gradeLevels={data.gradeLevels}
      classes={data.classes}
      allClasses={data.allClasses}
      teachers={data.teachers}
      gradeFilterOptions={data.gradeFilterOptions}
      appliedFilters={data.appliedFilters}
      totalClassCount={data.totalClassCount}
    />
  );
}

export default async function ClassManagementPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  if (role === "teacher") {
    return <TeacherClassesPageContent />;
  }

  if (!canManageSchoolStructure(role)) {
    notFound();
  }

  const sp = await searchParams;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6 sm:p-8">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {siteConfig.shortName}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Classes</h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              Roster overview, enrollment counts, and class lifecycle. Use{" "}
              <span className="text-foreground font-medium">+ New class</span> to create a class with
              homeroom and supporting teachers in one step, or adjust assignments later with{" "}
              <span className="text-foreground font-medium">Edit teachers</span> on each row.
              School years and grade levels live under{" "}
              <Link
                href={`/dashboard/${role}/school-settings#academic-structure`}
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                School settings → Academic structure
              </Link>
              . RLS applies for admin, principal, and vice principal accounts.
            </p>
          </div>
          <Link
            href={`/dashboard/${role}`}
            className="text-primary shrink-0 text-sm font-medium underline-offset-4 hover:underline"
          >
            Back to {roleLabels[role]} overview
          </Link>
        </div>
      </header>

      <Suspense fallback={<ClassManagementLoading />}>
        <ClassManagementBody role={role} searchParams={sp} />
      </Suspense>
    </div>
  );
}
