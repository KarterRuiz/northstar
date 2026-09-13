"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

import { changeStudentClassPlacement } from "./change-student-class-placement";
import { createStudentRecord } from "./create-student-record";
import { assertNoActiveHomeroomConflict } from "./assert-no-active-homeroom-conflict";
import { activeHomeroomConflictMessage } from "./current-homeroom";
import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "./enrollment-constants";
import {
  isStudentNumberUniqueViolation,
  parseStudentNumber,
  STUDENT_NUMBER_DUPLICATE_MESSAGE,
} from "./student-number";
import {
  isRedundantPostTransferAttempt,
  shouldTransferEnrollment,
} from "./transfer-student-enrollment";

export type StudentMutationState =
  | { ok: true; message?: string; studentId?: string }
  | { ok: false; message: string };

const NAME_MAX = 120;

function trimRequired(raw: string, label: string): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: `${label} is required.` };
  if (t.length > NAME_MAX) {
    return { ok: false, message: `${label} must be at most ${NAME_MAX} characters.` };
  }
  return { ok: true, value: t };
}

function trimOptional(raw: string, max: number): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function isUuid(value: string): boolean {
  return isStudentId(value);
}

function parseEnrollmentStatus(raw: string): EnrollmentStatusForm | null {
  const t = raw.trim();
  return (ENROLLMENT_STATUSES as readonly string[]).includes(t)
    ? (t as EnrollmentStatusForm)
    : null;
}

async function authorizeStudentMutation(
  formRoleRaw: FormDataEntryValue | null,
): Promise<
  | { ok: true; userId: string; role: Role }
  | { ok: false; message: string }
> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to manage students." };
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole || !canManageStudents(profileRole)) {
    return {
      ok: false,
      message: "You do not have permission to create or edit students.",
    };
  }

  const formRole = String(formRoleRaw ?? "");
  if (!isRole(formRole) || formRole !== profileRole) {
    return { ok: false, message: "Workspace mismatch; refresh the page and try again." };
  }

  return { ok: true, userId: user.id, role: profileRole };
}

async function fetchClassSchoolYearId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  classId: string,
): Promise<{ ok: true; schoolYearId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("classes")
    .select("school_year_id, is_active")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.school_year_id) {
    return { ok: false, message: "Selected class was not found." };
  }
  if (data.is_active === false) {
    return { ok: false, message: "That class is inactive; pick an active class." };
  }
  return { ok: true, schoolYearId: data.school_year_id };
}

export async function createStudentAction(
  _prev: StudentMutationState | undefined,
  formData: FormData,
): Promise<StudentMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeStudentMutation(formData.get("dashboardRole"));
  if (!auth.ok) return auth;

  const first = trimRequired(String(formData.get("firstName") ?? ""), "First name");
  if (!first.ok) return first;

  const last = trimRequired(String(formData.get("lastName") ?? ""), "Last name");
  if (!last.ok) return last;

  const preferredName = trimOptional(String(formData.get("preferredName") ?? ""), NAME_MAX);
  const externalId = parseStudentNumber(String(formData.get("externalId") ?? ""));
  if (!externalId.ok) return externalId;

  const classId = String(formData.get("classId") ?? "");
  if (!isUuid(classId)) {
    return { ok: false, message: "Pick a valid class." };
  }

  const status = parseEnrollmentStatus(String(formData.get("enrollmentStatus") ?? ""));
  if (!status) {
    return { ok: false, message: "Pick a valid enrollment status." };
  }

  const supabase = await createServerSupabaseClient();
  const cy = await fetchClassSchoolYearId(supabase, classId);
  if (!cy.ok) return cy;

  const created = await createStudentRecord(supabase, {
    firstName: first.value,
    lastName: last.value,
    preferredName,
    externalId: externalId.value,
    classId,
    schoolYearId: cy.schoolYearId,
    enrollmentStatus: status,
    actorUserId: auth.userId,
  });

  if (!created.ok) return created;

  revalidatePath(`/dashboard/${auth.role}/students`, "page");
  revalidatePath(`/dashboard/${auth.role}/students/${created.studentId}`, "layout");
  revalidatePath(`/dashboard/${auth.role}/classes/${classId}`, "layout");
  revalidatePath(`/dashboard/${auth.role}/classes/${classId}/students`, "page");

  return {
    ok: true,
    message: "Student created.",
    studentId: created.studentId,
  };
}

export async function updateStudentAction(
  _prev: StudentMutationState | undefined,
  formData: FormData,
): Promise<StudentMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeStudentMutation(formData.get("dashboardRole"));
  if (!auth.ok) return auth;

  const studentId = String(formData.get("studentId") ?? "");
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student id." };
  }

  const first = trimRequired(String(formData.get("firstName") ?? ""), "First name");
  if (!first.ok) return first;

  const last = trimRequired(String(formData.get("lastName") ?? ""), "Last name");
  if (!last.ok) return last;

  const preferredName = trimOptional(String(formData.get("preferredName") ?? ""), NAME_MAX);
  const externalId = parseStudentNumber(String(formData.get("externalId") ?? ""));
  if (!externalId.ok) return externalId;

  const classId = String(formData.get("classId") ?? "");
  if (!isUuid(classId)) {
    return { ok: false, message: "Pick a valid class." };
  }

  const status = parseEnrollmentStatus(String(formData.get("enrollmentStatus") ?? ""));
  if (!status) {
    return { ok: false, message: "Pick a valid enrollment status." };
  }

  const enrollmentIdRaw = String(formData.get("enrollmentId") ?? "").trim();
  const enrollmentId = enrollmentIdRaw.length > 0 ? enrollmentIdRaw : null;

  const supabase = await createServerSupabaseClient();

  const { data: beforeStudent, error: beforeStudentError } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name, external_id")
    .eq("id", studentId)
    .maybeSingle();

  if (beforeStudentError) {
    return { ok: false, message: beforeStudentError.message };
  }
  if (!beforeStudent) {
    return { ok: false, message: "Student not found." };
  }

  let beforeEnrollment: {
    id: string;
    class_id: string;
    school_year_id: string;
    status: string;
  } | null = null;

  if (enrollmentId) {
    if (!isUuid(enrollmentId)) {
      return { ok: false, message: "Invalid enrollment selection." };
    }
    const { data: enRow, error: enErr } = await supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, school_year_id, status")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (enErr) {
      return { ok: false, message: enErr.message };
    }
    if (!enRow || enRow.student_id !== studentId) {
      return { ok: false, message: "Enrollment record does not belong to this student." };
    }
    beforeEnrollment = enRow;
  }

  const cy = await fetchClassSchoolYearId(supabase, classId);
  if (!cy.ok) return cy;

  const changed: string[] = [];
  if (beforeStudent.first_name !== first.value) changed.push("first_name");
  if (beforeStudent.last_name !== last.value) changed.push("last_name");
  const prevPref = beforeStudent.preferred_name?.trim() || "";
  const newPref = preferredName ?? "";
  if (prevPref !== newPref) changed.push("preferred_name");
  const prevExt = beforeStudent.external_id?.trim() || "";
  const newExt = externalId.value;
  if (prevExt !== newExt) changed.push("external_id");

  let transferSourceClassId: string | null = null;

  if (
    beforeEnrollment &&
    shouldTransferEnrollment({
      enrollmentId: beforeEnrollment.id,
      beforeClassId: beforeEnrollment.class_id,
      nextClassId: classId,
    })
  ) {
    const { data: existingDestActive, error: existingDestErr } = await supabase
      .from("student_enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("class_id", classId)
      .eq("status", "active")
      .maybeSingle();

    if (existingDestErr) {
      return { ok: false, message: existingDestErr.message };
    }

    // Duplicate submit after a successful transfer: source is already withdrawn and
    // destination is already active — do not call transfer again or show a false error.
    if (
      isRedundantPostTransferAttempt({
        sourceStatus: beforeEnrollment.status,
        sourceClassId: beforeEnrollment.class_id,
        destinationClassId: classId,
        destinationHasActiveEnrollment: Boolean(existingDestActive?.id),
      })
    ) {
      transferSourceClassId = beforeEnrollment.class_id;
      changed.push("class_placement_already_transferred");
    } else {
      // Transfer before profile update so a failed placement leaves no ambiguous state.
      const transferred = await changeStudentClassPlacement(supabase, {
        enrollmentId: beforeEnrollment.id,
        destinationClassId: classId,
      });
      if (!transferred.ok) {
        // Concurrent double-submit: peer may have finished the transfer first.
        const { data: destAfterFail } = await supabase
          .from("student_enrollments")
          .select("id")
          .eq("student_id", studentId)
          .eq("class_id", classId)
          .eq("status", "active")
          .maybeSingle();
        const { data: sourceAfterFail } = await supabase
          .from("student_enrollments")
          .select("status")
          .eq("id", beforeEnrollment.id)
          .maybeSingle();

        if (
          isRedundantPostTransferAttempt({
            sourceStatus: sourceAfterFail?.status ?? beforeEnrollment.status,
            sourceClassId: beforeEnrollment.class_id,
            destinationClassId: classId,
            destinationHasActiveEnrollment: Boolean(destAfterFail?.id),
          })
        ) {
          transferSourceClassId = beforeEnrollment.class_id;
          changed.push("class_placement_already_transferred");
        } else {
          return transferred;
        }
      } else {
        transferSourceClassId = transferred.sourceClassId;
        changed.push("class_placement_transferred");

        await recordAuditEvent({
          action: "student_class_transferred",
          actorUserId: auth.userId,
          metadata: {
            studentId,
            sourceEnrollmentId: transferred.sourceEnrollmentId,
            destinationEnrollmentId: transferred.destinationEnrollmentId,
            sourceClassId: transferred.sourceClassId,
            destinationClassId: transferred.destinationClassId,
            createdDestination: transferred.createdDestination,
          },
        });
      }
    }
  } else if (beforeEnrollment) {
    if (beforeEnrollment.status !== status) {
      if (status === "active") {
        const guard = await assertNoActiveHomeroomConflict(supabase, {
          studentId,
          schoolYearId: beforeEnrollment.school_year_id,
          nextStatus: status,
          excludeEnrollmentId: beforeEnrollment.id,
        });
        if (!guard.ok) return guard;
      }
      const { error: updEnError } = await supabase
        .from("student_enrollments")
        .update({ status })
        .eq("id", beforeEnrollment.id);

      if (updEnError) {
        if (
          updEnError.message.includes(
            "student_enrollments_one_active_homeroom_per_year_uidx",
          )
        ) {
          return {
            ok: false,
            message: activeHomeroomConflictMessage(updEnError.message),
          };
        }
        return { ok: false, message: updEnError.message };
      }
      changed.push("enrollment_status");
    }
  } else {
    const guard = await assertNoActiveHomeroomConflict(supabase, {
      studentId,
      schoolYearId: cy.schoolYearId,
      nextStatus: status,
    });
    if (!guard.ok) return guard;

    const { error: insEnError } = await supabase.from("student_enrollments").insert({
      student_id: studentId,
      class_id: classId,
      school_year_id: cy.schoolYearId,
      status,
    });

    if (insEnError) {
      if (
        insEnError.message.includes(
          "student_enrollments_one_active_homeroom_per_year_uidx",
        )
      ) {
        return {
          ok: false,
          message: activeHomeroomConflictMessage(insEnError.message),
        };
      }
      return { ok: false, message: insEnError.message };
    }
    changed.push("enrollment_created");
  }

  const { error: updStudentError } = await supabase
    .from("students")
    .update({
      first_name: first.value,
      last_name: last.value,
      preferred_name: preferredName,
      external_id: externalId.value,
    })
    .eq("id", studentId);

  if (updStudentError) {
    const msg = isStudentNumberUniqueViolation(
      updStudentError.message,
      updStudentError.code,
    )
      ? STUDENT_NUMBER_DUPLICATE_MESSAGE
      : updStudentError.message;
    return { ok: false, message: msg };
  }

  await recordAuditEvent({
    action: "student_updated",
    actorUserId: auth.userId,
    metadata: {
      studentId,
      changedSummary:
        changed.length > 0 ? changed.join(", ") : "no_field_changes_detected",
      ...(changed.includes("external_id")
        ? { previousExternalId: prevExt || null, externalId: newExt }
        : {}),
    },
  });

  revalidatePath(`/dashboard/${auth.role}/students`, "page");
  revalidatePath(`/dashboard/${auth.role}/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/${auth.role}/classes/${classId}`, "layout");
  revalidatePath(`/dashboard/${auth.role}/classes/${classId}/students`, "page");
  if (transferSourceClassId) {
    revalidatePath(`/dashboard/${auth.role}/classes/${transferSourceClassId}`, "layout");
    revalidatePath(
      `/dashboard/${auth.role}/classes/${transferSourceClassId}/students`,
      "page",
    );
    // Leave the edit form (stale enrollmentId / class picker) so the UI cannot
    // re-submit transfer against the withdrawn source enrollment.
    redirect(`/dashboard/${auth.role}/students/${studentId}/overview`);
  }

  return {
    ok: true,
    message: "Student updated.",
    studentId,
  };
}
