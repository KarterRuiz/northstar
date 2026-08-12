import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageClassEnrollment, isRole, type Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TeacherBulkAddForm } from "@/features/teacher/roster/teacher-bulk-add-form";
import { classWorkspacePath } from "@/features/teacher/class-workspace/constants";
import { loadTeacherRosterClassContext } from "@/features/teacher/roster/load-teacher-roster-page";
import { isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Bulk add students",
};

type PageProps = {
  params: Promise<{ role: string; classId: string }>;
};

export default async function TeacherBulkAddStudentsPage({ params }: PageProps) {
  const { role: roleParam, classId } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  if (role !== "teacher") notFound();
  if (!isUuid(classId)) notFound();

  const studentsHref = classWorkspacePath(classId, "students");

  if (!canManageClassEnrollment(role)) {
    return (
      <Card className="space-y-3 p-4 sm:p-5">
        <h2 className="text-heading text-base font-semibold">Class roster is managed by leadership</h2>
        <p className="ns-muted">
          Ask an administrator or school leader to add students to this class. You can still
          open and work with the students already assigned to you.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={studentsHref}>Back to students</Link>
        </Button>
      </Card>
    );
  }

  const ctx = await loadTeacherRosterClassContext(classId);
  if (!ctx.ok) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {ctx.message}
      </p>
    );
  }

  return (
    <TeacherBulkAddForm
      classId={ctx.classId}
      classLabel={ctx.classLabel}
      rosterHref={ctx.rosterHref}
    />
  );
}
