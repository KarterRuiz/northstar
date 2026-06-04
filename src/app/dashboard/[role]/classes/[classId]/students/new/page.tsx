import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { TeacherAddStudentForm } from "@/features/teacher/roster/teacher-add-student-form";
import { loadTeacherRosterClassContext } from "@/features/teacher/roster/load-teacher-roster-page";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Add student",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function TeacherAddStudentPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  const ctx = await loadTeacherRosterClassContext(classId);
  if (!ctx.ok) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-6 sm:p-8">
        <p className="text-destructive text-sm" role="alert">
          {ctx.message}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/teacher/classes">All my classes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-widest uppercase">
            {siteConfig.shortName} · Class roster
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Add student</h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-snug">
            Create a student record and enroll them in{" "}
            <span className="text-foreground font-medium">{ctx.classLabel}</span> with active
            status for the class school year.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={ctx.rosterHref}>Back to roster</Link>
        </Button>
      </div>

      <TeacherAddStudentForm
        classId={ctx.classId}
        classLabel={ctx.classLabel}
        rosterHref={ctx.rosterHref}
      />
    </div>
  );
}
