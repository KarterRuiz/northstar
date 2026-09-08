import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { assertStudentDirectoryAccess } from "@/features/students/profile/access";
import { loadStudentFormClassOptions } from "@/features/students/student-form-queries";
import { StudentForm } from "@/features/students/student-form";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "New student",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ classId?: string }>;
};

export default async function NewStudentPage({ params, searchParams }: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  assertStudentDirectoryAccess(role);
  if (!canManageStudents(role)) notFound();

  const { classId: classIdRaw } = await searchParams;
  const preferredClassId =
    classIdRaw && isUuid(classIdRaw) ? classIdRaw : undefined;

  const classesLoad = await loadStudentFormClassOptions();
  const initialClassId =
    preferredClassId &&
    classesLoad.ok &&
    classesLoad.classes.some((c) => c.id === preferredClassId)
      ? preferredClassId
      : classesLoad.ok
        ? (classesLoad.classes[0]?.id ?? "")
        : "";

  const backHref = preferredClassId
    ? `/dashboard/${role}/classes/${preferredClassId}/students`
    : `/dashboard/${role}/students`;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-widest uppercase">
            {siteConfig.shortName} · Students
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Add student
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-snug">
            Create a record and enroll in an active class for the current school year.
            Grade follows the class.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={backHref}>{preferredClassId ? "Back to class" : "Directory"}</Link>
        </Button>
      </div>

      {!classesLoad.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {classesLoad.message}
        </p>
      ) : (
        <StudentForm
          dashboardRole={role}
          mode="create"
          classOptions={classesLoad.classes}
          initialClassId={initialClassId}
        />
      )}
    </div>
  );
}
