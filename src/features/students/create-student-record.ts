import "server-only";

import { recordAuditEvent } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/types";
import { logServerError, safeUserFacingMessage } from "@/lib/errors/safe-user-message";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

import { assertNoActiveHomeroomConflict } from "./assert-no-active-homeroom-conflict";
import { activeHomeroomConflictMessage } from "./current-homeroom";
import type { EnrollmentStatusForm } from "./enrollment-constants";
import {
  isStudentNumberUniqueViolation,
  parseStudentNumber,
  STUDENT_NUMBER_DUPLICATE_MESSAGE,
} from "./student-number";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Shared student + enrollment create path.
 *
 * Identity: `students.id` = Northstar Record ID (UUID);
 * `externalId` = school Student Number (required, unique, portable);
 * `rosterNumber` = class-scoped only (never the Student Number).
 */
export type CreateStudentRecordInput = {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  /** School Student Number (`students.external_id`). Required for new students. */
  externalId: string;
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
  const parsedNumber = parseStudentNumber(input.externalId);
  if (!parsedNumber.ok) return parsedNumber;

  const { data: inserted, error: insertStudentError } = await supabase
    .from("students")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      preferred_name: input.preferredName,
      external_id: parsedNumber.value,
    })
    .select("id")
    .single();

  if (insertStudentError || !inserted?.id) {
    if (insertStudentError) {
      logServerError("students.createStudentRecord.insert", insertStudentError.message);
    }
    const msg = isStudentNumberUniqueViolation(
      insertStudentError?.message,
      insertStudentError?.code,
    )
      ? STUDENT_NUMBER_DUPLICATE_MESSAGE
      : safeUserFacingMessage(
          insertStudentError?.message,
          "Could not create the student.",
        );
    return { ok: false, message: msg };
  }

  const studentId = inserted.id;

  const homeroomGuard = await assertNoActiveHomeroomConflict(supabase, {
    studentId,
    schoolYearId: input.schoolYearId,
    nextStatus: input.enrollmentStatus,
  });
  if (!homeroomGuard.ok) {
    await supabase.from("students").delete().eq("id", studentId);
    return { ok: false, message: homeroomGuard.message };
  }

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
    if (
      enrollError.message.includes("student_enrollments_one_active_homeroom_per_year_uidx")
    ) {
      return { ok: false, message: activeHomeroomConflictMessage(enrollError.message) };
    }
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
      externalId: parsedNumber.value,
    },
  });

  return { ok: true, studentId };
}
