import "server-only";

import { recordAuditEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/types";
import { logServerError, safeUserFacingMessage } from "@/lib/errors/safe-user-message";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

import type { EnrollmentStatusForm } from "./enrollment-constants";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type CreateStudentRecordInput = {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  externalId: string | null;
  classId: string;
  schoolYearId: string;
  enrollmentStatus: EnrollmentStatusForm;
  /** Class-scoped roster order. Null when not set. Distinct from externalId. */
  rosterNumber?: number | null;
  actorUserId: string;
  auditAction?: Extract<AuditAction, "student_created" | "teacher_student_created">;
};

export type CreateStudentRecordResult =
  | { ok: true; studentId: string }
  | { ok: false; message: string };

/**
 * Shared student + enrollment create path used by single-add and bulk-add.
 * Rolls back the student row if enrollment insert fails.
 */
export async function createStudentRecord(
  supabase: Supabase,
  input: CreateStudentRecordInput,
): Promise<CreateStudentRecordResult> {
  const { data: inserted, error: insertStudentError } = await supabase
    .from("students")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      preferred_name: input.preferredName,
      external_id: input.externalId,
    })
    .select("id")
    .single();

  if (insertStudentError || !inserted?.id) {
    if (insertStudentError) {
      logServerError("students.createStudentRecord.insert", insertStudentError.message);
    }
    const msg =
      insertStudentError?.message.includes("students_external_id_unique") ||
      insertStudentError?.code === "23505"
        ? "That student number (external ID) is already in use."
        : safeUserFacingMessage(
            insertStudentError?.message,
            "Could not create the student.",
          );
    return { ok: false, message: msg };
  }

  const studentId = inserted.id;

  const { error: enrollError } = await supabase.from("student_enrollments").insert({
    student_id: studentId,
    class_id: input.classId,
    school_year_id: input.schoolYearId,
    status: input.enrollmentStatus,
    roster_number: input.rosterNumber ?? null,
  });

  if (enrollError) {
    logServerError("students.createStudentRecord.enroll", enrollError.message);
    await supabase.from("students").delete().eq("id", studentId);
    const rosterConflict =
      enrollError.message.includes("student_enrollments_active_class_roster_uidx") ||
      enrollError.code === "23505";
    return {
      ok: false,
      message: rosterConflict
        ? `Roster # ${input.rosterNumber} is already used in this class.`
        : safeUserFacingMessage(
            enrollError.message,
            "Could not create the enrollment row.",
          ),
    };
  }

  await recordAuditEvent({
    action: input.auditAction ?? "student_created",
    actorUserId: input.actorUserId,
    metadata: {
      studentId,
      classId: input.classId,
      enrollmentStatus: input.enrollmentStatus,
    },
  });

  return { ok: true, studentId };
}
