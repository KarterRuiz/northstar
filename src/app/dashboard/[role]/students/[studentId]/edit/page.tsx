import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canManageStudents, canTeacherEditStudentBasicInfo, isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { assertStudentDirectoryAccess } from "@/features/students/profile/access";
import {
  loadStudentEditFormModel,
  loadStudentFormClassOptions,
} from "@/features/students/student-form-queries";
import { StudentForm } from "@/features/students/student-form";
import { TeacherEditStudentForm } from "@/features/teacher/roster/teacher-edit-student-form";
import { loadTeacherEditStudentModel } from "@/features/teacher/roster/load-teacher-roster-page";
import { isStudentId } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Edit student",
};

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function EditStudentPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();
  const role = roleParam as Role;
  assertStudentDirectoryAccess(role);
  const isAdminEdit = canManageStudents(role);
  const isTeacherEdit = canTeacherEditStudentBasicInfo(role);
  if (!isAdminEdit && !isTeacherEdit) notFound();

  if (isTeacherEdit) {
    const teacherModel = await loadTeacherEditStudentModel(studentId);
    if (!teacherModel.ok && teacherModel.kind === "not_found") {
      notFound();
    }

    const profileHref = `/dashboard/${role}/students/${studentId}/overview`;

    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-widest uppercase">
              {siteConfig.shortName} · Students
            </p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Edit student
            </h1>
            <p className="text-muted-foreground max-w-xl text-sm leading-snug">
              Update name fields for a student on your assigned class rosters.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href={profileHref}>Profile overview</Link>
          </Button>
        </div>

        {!teacherModel.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {teacherModel.message ?? "Could not load this student."}
          </p>
        ) : (
          <TeacherEditStudentForm
            studentId={teacherModel.studentId}
            initialFirstName={teacherModel.firstName}
            initialLastName={teacherModel.lastName}
            initialPreferredName={teacherModel.preferredName}
            profileHref={profileHref}
          />
        )}
      </div>
    );
  }

  const [classesLoad, model] = await Promise.all([
    loadStudentFormClassOptions(),
    loadStudentEditFormModel(studentId),
  ]);

  if (!model.ok && model.kind === "not_found") {
    notFound();
  }

  const firstEn = model.ok ? model.enrollmentChoices[0] : undefined;
  const initialClassId = firstEn?.classId ?? "";
  const initialEnrollmentStatus = firstEn?.status ?? "active";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-widest uppercase">
            {siteConfig.shortName} · Students
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Edit student
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm leading-snug">
            Update directory fields and class placement for the current school year.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={`/dashboard/${role}/students/${studentId}/overview`}>
            Profile overview
          </Link>
        </Button>
      </div>

      {!classesLoad.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {classesLoad.message}
        </p>
      ) : !model.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {model.message ?? "Could not load this student."}
        </p>
      ) : (
        <StudentForm
          dashboardRole={role}
          mode="edit"
          studentId={model.studentId}
          classOptions={classesLoad.classes}
          initialFirstName={model.firstName}
          initialLastName={model.lastName}
          initialPreferredName={model.preferredName}
          initialExternalId={model.externalId}
          initialClassId={initialClassId}
          initialEnrollmentStatus={initialEnrollmentStatus}
          enrollmentChoices={model.enrollmentChoices}
        />
      )}
    </div>
  );
}
