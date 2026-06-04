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
};

async function ClassManagementBody() {
  const data = await loadClassManagementPageData();

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
      schoolYears={data.schoolYears}
      gradeLevels={data.gradeLevels}
      classes={data.classes}
      teachers={data.teachers}
    />
  );
}

export default async function ClassManagementPage({ params }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;

  if (role === "teacher") {
    return <TeacherClassesPageContent />;
  }

  if (!canManageSchoolStructure(role)) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {siteConfig.shortName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Class management</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Create school years, grade levels, and classes; assign homeroom and additional teachers.
          Changes are enforced by RLS for admin, principal, and vice principal accounts.
        </p>
        <p className="text-sm">
          <Link
            href={`/dashboard/${role}`}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Back to {roleLabels[role]} overview
          </Link>
        </p>
      </div>

      <Suspense fallback={<ClassManagementLoading />}>
        <ClassManagementBody />
      </Suspense>
    </div>
  );
}
