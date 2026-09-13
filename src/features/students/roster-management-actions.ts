"use server";

import { revalidatePath } from "next/cache";

import { canManageClassEnrollment, isRole, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getProfileRole, getUser } from "@/lib/auth/session";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
  safeUserFacingMessage,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId, isUuid } from "@/lib/students/uuid";

import { assessStudentDeleteSafety } from "./assess-student-delete-safety";
import { assertNoActiveHomeroomConflict } from "./assert-no-active-homeroom-conflict";
import { activeHomeroomConflictMessage } from "./current-homeroom";
import { studentDeleteBlockedMessage } from "./student-delete-safety";

export type RosterMutationState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

async function authorizeRosterMutation(
  formRoleRaw: FormDataEntryValue | null,
): Promise<
  | { ok: true; userId: string; role: Role }
  | { ok: false; message: string }
> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to manage class rosters." };
  }

  const profileRole = await getProfileRole(user.id);
  if (!profileRole || !canManageClassEnrollment(profileRole)) {
    return {
      ok: false,
      message: "You do not have permission to change class enrollments.",
    };
  }

  const formRole = String(formRoleRaw ?? "");
  if (!isRole(formRole) || formRole !== profileRole) {
    return { ok: false, message: "Workspace mismatch; refresh the page and try again." };
  }

  return { ok: true, userId: user.id, role: profileRole };
}

function parseStudentIds(formData: FormData): string[] {
  const multi = formData.getAll("studentIds").map((v) => String(v).trim()).filter(Boolean);
  if (multi.length > 0) {
    return [...new Set(multi.filter((id) => isStudentId(id)))];
  }
  const single = String(formData.get("studentId") ?? "").trim();
  return isStudentId(single) ? [single] : [];
}

function revalidateRosterPaths(role: Role, classId: string, studentIds: string[]) {
  revalidatePath(`/dashboard/${role}/classes/${classId}`, "layout");
  revalidatePath(`/dashboard/${role}/classes/${classId}/students`, "page");
  revalidatePath(`/dashboard/${role}/students`, "page");
  for (const studentId of studentIds) {
    revalidatePath(`/dashboard/${role}/students/${studentId}`, "layout");
  }
}

async function loadActiveEnrollment(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentId: string,
  classId: string,
): Promise<
  | { ok: true; enrollmentId: string }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("student_enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    logServerError("roster.loadActiveEnrollment", error.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (!data?.id) {
    return { ok: false, message: "That student is not actively enrolled in this class." };
  }
  return { ok: true, enrollmentId: data.id };
}

/**
 * Remove active enrollment from a class only. Preserves the student row and history.
 * Marks the enrollment `withdrawn` (does not hard-delete the enrollment row).
 */
export async function removeStudentFromClassAction(
  _prev: RosterMutationState | undefined,
  formData: FormData,
): Promise<RosterMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeRosterMutation(formData.get("dashboardRole"));
  if (!auth.ok) return auth;

  const classId = String(formData.get("classId") ?? "").trim();
  if (!isUuid(classId)) {
    return { ok: false, message: "Invalid class." };
  }

  const studentIds = parseStudentIds(formData);
  if (studentIds.length === 0) {
    return { ok: false, message: "Select at least one student." };
  }

  const supabase = await createServerSupabaseClient();
  const removed: string[] = [];
  const enrollmentIds: string[] = [];

  for (const studentId of studentIds) {
    const en = await loadActiveEnrollment(supabase, studentId, classId);
    if (!en.ok) {
      if (studentIds.length === 1) return en;
      continue;
    }

    const { error } = await supabase
      .from("student_enrollments")
      .update({ status: "withdrawn" })
      .eq("id", en.enrollmentId);

    if (error) {
      logServerError("roster.removeFromClass", error.message);
      return {
        ok: false,
        message: safeUserFacingMessage(error.message, "Could not remove the student from class."),
      };
    }

    removed.push(studentId);
    enrollmentIds.push(en.enrollmentId);

    await recordAuditEvent({
      action: "student_removed_from_class",
      actorUserId: auth.userId,
      metadata: {
        studentId,
        classId,
        enrollmentId: en.enrollmentId,
      },
    });
  }

  if (removed.length === 0) {
    return { ok: false, message: "No active enrollments were removed." };
  }

  revalidateRosterPaths(auth.role, classId, removed);

  return {
    ok: true,
    message:
      removed.length === 1
        ? "Student removed from class. Their record and history remain in NorthStar."
        : `${removed.length} students removed from class. Records and history remain in NorthStar.`,
  };
}

/**
 * Withdraw all active enrollments for a student (archive). History is preserved.
 */
export async function archiveStudentAction(
  _prev: RosterMutationState | undefined,
  formData: FormData,
): Promise<RosterMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeRosterMutation(formData.get("dashboardRole"));
  if (!auth.ok) return auth;

  const classId = String(formData.get("classId") ?? "").trim();
  if (classId && !isUuid(classId)) {
    return { ok: false, message: "Invalid class." };
  }

  const studentIds = parseStudentIds(formData);
  if (studentIds.length === 0) {
    return { ok: false, message: "Select at least one student." };
  }

  const supabase = await createServerSupabaseClient();
  let archivedCount = 0;

  for (const studentId of studentIds) {
    const { data: rows, error: loadErr } = await supabase
      .from("student_enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("status", "active");

    if (loadErr) {
      logServerError("roster.archiveStudent.load", loadErr.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const ids = (rows ?? []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) {
      if (studentIds.length === 1) {
        return { ok: false, message: "This student has no active enrollments to archive." };
      }
      continue;
    }

    const { error } = await supabase
      .from("student_enrollments")
      .update({ status: "withdrawn" })
      .in("id", ids);

    if (error) {
      logServerError("roster.archiveStudent", error.message);
      return {
        ok: false,
        message: safeUserFacingMessage(error.message, "Could not archive this student."),
      };
    }

    archivedCount += 1;
    await recordAuditEvent({
      action: "student_archived",
      actorUserId: auth.userId,
      metadata: {
        studentId,
        withdrawnEnrollmentIds: ids,
      },
    });
  }

  if (archivedCount === 0) {
    return { ok: false, message: "No students were archived." };
  }

  if (classId) {
    revalidateRosterPaths(auth.role, classId, studentIds);
  } else {
    revalidatePath(`/dashboard/${auth.role}/students`, "page");
    for (const studentId of studentIds) {
      revalidatePath(`/dashboard/${auth.role}/students/${studentId}`, "layout");
    }
  }

  return {
    ok: true,
    message:
      archivedCount === 1
        ? "Student archived. Active enrollments were withdrawn; history remains."
        : `${archivedCount} students archived. Active enrollments were withdrawn; history remains.`,
  };
}

/**
 * Permanent delete — only when the student has no meaningful dependent history.
 */
export async function deleteStudentAction(
  _prev: RosterMutationState | undefined,
  formData: FormData,
): Promise<RosterMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeRosterMutation(formData.get("dashboardRole"));
  if (!auth.ok) return auth;

  const classId = String(formData.get("classId") ?? "").trim();
  if (classId && !isUuid(classId)) {
    return { ok: false, message: "Invalid class." };
  }

  const studentId = String(formData.get("studentId") ?? "").trim();
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student." };
  }

  // Bulk permanent delete is intentionally unsupported.
  if (formData.getAll("studentIds").length > 1) {
    return {
      ok: false,
      message: "Permanent delete is only available one student at a time.",
    };
  }

  const supabase = await createServerSupabaseClient();

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr) {
    logServerError("roster.deleteStudent.load", studentErr.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (!student) {
    return { ok: false, message: "Student not found." };
  }

  let safety;
  try {
    safety = await assessStudentDeleteSafety(supabase, studentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not assess delete safety.";
    logServerError("roster.deleteStudent.safety", message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  if (!safety.canHardDelete) {
    return { ok: false, message: studentDeleteBlockedMessage(safety) };
  }

  const displayName =
    student.preferred_name?.trim() ||
    [student.first_name, student.last_name].filter(Boolean).join(" ").trim() ||
    "Student";

  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) {
    logServerError("roster.deleteStudent", error.message);
    return {
      ok: false,
      message: safeUserFacingMessage(
        error.message,
        "Could not delete this student. Prefer archive or remove from class.",
      ),
    };
  }

  await recordAuditEvent({
    action: "student_deleted",
    actorUserId: auth.userId,
    metadata: {
      studentId,
      displayName,
    },
  });

  if (classId) {
    revalidateRosterPaths(auth.role, classId, [studentId]);
  } else {
    revalidatePath(`/dashboard/${auth.role}/students`, "page");
  }

  return { ok: true, message: `${displayName} was permanently deleted.` };
}

/**
 * Enroll an existing student into this class (active). Does not create a new student row.
 */
export async function enrollExistingStudentInClassAction(
  _prev: RosterMutationState | undefined,
  formData: FormData,
): Promise<RosterMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const auth = await authorizeRosterMutation(formData.get("dashboardRole"));
  if (!auth.ok) return auth;

  const classId = String(formData.get("classId") ?? "").trim();
  if (!isUuid(classId)) {
    return { ok: false, message: "Invalid class." };
  }

  const studentId = String(formData.get("studentId") ?? "").trim();
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Pick a valid student." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: klass, error: classErr } = await supabase
    .from("classes")
    .select("id, school_year_id, is_active")
    .eq("id", classId)
    .maybeSingle();

  if (classErr) {
    logServerError("roster.enrollExisting.class", classErr.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (!klass?.school_year_id) {
    return { ok: false, message: "Class was not found." };
  }
  if (klass.is_active === false) {
    return { ok: false, message: "That class is inactive; restore it before enrolling students." };
  }

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr) {
    logServerError("roster.enrollExisting.student", studentErr.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (!student) {
    return { ok: false, message: "Student not found." };
  }

  const existing = await loadActiveEnrollment(supabase, studentId, classId);
  if (existing.ok) {
    return { ok: false, message: "That student is already enrolled in this class." };
  }

  const { data: priorRows, error: priorErr } = await supabase
    .from("student_enrollments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (priorErr) {
    logServerError("roster.enrollExisting.prior", priorErr.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const prior = priorRows?.[0] ?? null;

  const guard = await assertNoActiveHomeroomConflict(supabase, {
    studentId,
    schoolYearId: klass.school_year_id,
    nextStatus: "active",
    excludeEnrollmentId: prior?.id ?? null,
  });
  if (!guard.ok) {
    return {
      ok: false,
      message: `${guard.message} Use Transfer on the student edit form to move them between classes.`,
    };
  }

  let enrollmentId: string | undefined;

  if (prior?.id) {
    const { error } = await supabase
      .from("student_enrollments")
      .update({
        status: "active",
        school_year_id: klass.school_year_id,
      })
      .eq("id", prior.id);
    if (error) {
      logServerError("roster.enrollExisting.reactivate", error.message);
      if (
        error.message.includes("student_enrollments_one_active_homeroom_per_year_uidx")
      ) {
        return {
          ok: false,
          message: `${activeHomeroomConflictMessage(error.message)} Use Transfer on the student edit form to move them between classes.`,
        };
      }
      return {
        ok: false,
        message: safeUserFacingMessage(error.message, "Could not enroll this student."),
      };
    }
    enrollmentId = prior.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("student_enrollments")
      .insert({
        student_id: studentId,
        class_id: classId,
        school_year_id: klass.school_year_id,
        status: "active",
      })
      .select("id")
      .maybeSingle();
    if (error) {
      logServerError("roster.enrollExisting.insert", error.message);
      if (
        error.message.includes("student_enrollments_one_active_homeroom_per_year_uidx")
      ) {
        return {
          ok: false,
          message: `${activeHomeroomConflictMessage(error.message)} Use Transfer on the student edit form to move them between classes.`,
        };
      }
      return {
        ok: false,
        message: safeUserFacingMessage(error.message, "Could not enroll this student."),
      };
    }
    enrollmentId = inserted?.id;
  }

  await recordAuditEvent({
    action: "student_enrolled_in_class",
    actorUserId: auth.userId,
    metadata: {
      studentId,
      classId,
      enrollmentId: enrollmentId ?? null,
    },
  });

  revalidateRosterPaths(auth.role, classId, [studentId]);
  return { ok: true, message: "Student enrolled in this class." };
}
