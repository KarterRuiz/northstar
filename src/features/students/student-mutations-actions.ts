"use server";

import { revalidatePath } from "next/cache";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

import {
  ENROLLMENT_STATUSES,
  type EnrollmentStatusForm,
} from "./enrollment-constants";

export type StudentMutationState =
  | { ok: true; message?: string; studentId?: string }
  | { ok: false; message: string };

const NAME_MAX = 120;
const EXTERNAL_ID_MAX = 64;

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
  const externalId = trimOptional(String(formData.get("externalId") ?? ""), EXTERNAL_ID_MAX);

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

  const { data: inserted, error: insertStudentError } = await supabase
    .from("students")
    .insert({
      first_name: first.value,
      last_name: last.value,
      preferred_name: preferredName,
      external_id: externalId,
    })
    .select("id")
    .single();

  if (insertStudentError || !inserted?.id) {
    const msg =
      insertStudentError?.message.includes("students_external_id_unique") ||
      insertStudentError?.code === "23505"
        ? "That student number (external ID) is already in use."
        : insertStudentError?.message || "Could not create the student.";
    return { ok: false, message: msg };
  }

  const studentId = inserted.id;

  const { error: enrollError } = await supabase.from("student_enrollments").insert({
    student_id: studentId,
    class_id: classId,
    school_year_id: cy.schoolYearId,
    status,
  });

  if (enrollError) {
    await supabase.from("students").delete().eq("id", studentId);
    return {
      ok: false,
      message: enrollError.message || "Could not create the enrollment row.",
    };
  }

  await recordAuditEvent({
    action: "student_created",
    actorUserId: auth.userId,
    metadata: {
      studentId,
      classId,
      enrollmentStatus: status,
    },
  });

  revalidatePath(`/dashboard/${auth.role}/students`, "page");
  revalidatePath(`/dashboard/${auth.role}/students/${studentId}`, "layout");

  return {
    ok: true,
    message: "Student created.",
    studentId,
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
  const externalId = trimOptional(String(formData.get("externalId") ?? ""), EXTERNAL_ID_MAX);

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

  const { error: updStudentError } = await supabase
    .from("students")
    .update({
      first_name: first.value,
      last_name: last.value,
      preferred_name: preferredName,
      external_id: externalId,
    })
    .eq("id", studentId);

  if (updStudentError) {
    const msg =
      updStudentError.message.includes("students_external_id_unique") ||
      updStudentError.code === "23505"
        ? "That student number (external ID) is already in use."
        : updStudentError.message;
    return { ok: false, message: msg };
  }

  if (beforeEnrollment) {
    const { error: updEnError } = await supabase
      .from("student_enrollments")
      .update({
        class_id: classId,
        school_year_id: cy.schoolYearId,
        status,
      })
      .eq("id", beforeEnrollment.id);

    if (updEnError) {
      return { ok: false, message: updEnError.message };
    }
  } else {
    const { error: insEnError } = await supabase.from("student_enrollments").insert({
      student_id: studentId,
      class_id: classId,
      school_year_id: cy.schoolYearId,
      status,
    });

    if (insEnError) {
      return { ok: false, message: insEnError.message };
    }
  }

  const changed: string[] = [];
  if (beforeStudent.first_name !== first.value) changed.push("first_name");
  if (beforeStudent.last_name !== last.value) changed.push("last_name");
  const prevPref = beforeStudent.preferred_name?.trim() || "";
  const newPref = preferredName ?? "";
  if (prevPref !== newPref) changed.push("preferred_name");
  const prevExt = beforeStudent.external_id?.trim() || "";
  const newExt = externalId ?? "";
  if (prevExt !== newExt) changed.push("external_id");

  if (beforeEnrollment) {
    if (beforeEnrollment.class_id !== classId) changed.push("class_id");
    if (beforeEnrollment.status !== status) changed.push("enrollment_status");
  } else {
    changed.push("enrollment_created");
  }

  await recordAuditEvent({
    action: "student_updated",
    actorUserId: auth.userId,
    metadata: {
      studentId,
      changedSummary:
        changed.length > 0 ? changed.join(", ") : "no_field_changes_detected",
    },
  });

  revalidatePath(`/dashboard/${auth.role}/students`, "page");
  revalidatePath(`/dashboard/${auth.role}/students/${studentId}`, "layout");

  return { ok: true, message: "Student updated.", studentId };
}
