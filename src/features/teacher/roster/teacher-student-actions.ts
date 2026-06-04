"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import {
  requireTeacherAssignedToClass,
  requireTeacherCanAccessStudent,
} from "@/lib/auth/teacher-class-access";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isStudentId } from "@/lib/students/uuid";

import { parseBulkRosterPaste } from "./parse-bulk-roster";

export type TeacherStudentMutationState =
  | { ok: true; message?: string; studentId?: string }
  | { ok: false; message: string };

export type TeacherBulkRosterState =
  | {
      ok: true;
      message: string;
      createdCount: number;
      failed: { line: number; message: string }[];
    }
  | { ok: false; message: string; failed?: { line: number; message: string }[] };

const NAME_MAX = 120;

function trimRequired(
  raw: string,
  label: string,
): { ok: true; value: string } | { ok: false; message: string } {
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

type TeacherBulkCreateRpcResult = {
  created_count: number;
  created_ids: string[];
  failed: { line: number; message: string }[];
};

function revalidateTeacherClassPaths(classId: string, studentId?: string) {
  revalidatePath("/dashboard/teacher/classes", "page");
  revalidatePath(`/dashboard/teacher/classes/${classId}`, "page");
  if (studentId) {
    revalidatePath(`/dashboard/teacher/students/${studentId}`, "layout");
  }
}

export async function teacherCreateStudentAction(
  _prev: TeacherStudentMutationState | undefined,
  formData: FormData,
): Promise<TeacherStudentMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const classId = String(formData.get("classId") ?? "");
  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const first = trimRequired(String(formData.get("firstName") ?? ""), "First name");
  if (!first.ok) return first;

  const last = trimRequired(String(formData.get("lastName") ?? ""), "Last name");
  if (!last.ok) return last;

  const preferredName = trimOptional(String(formData.get("preferredName") ?? ""), NAME_MAX);

  const { data: studentId, error: createError } = await gate.supabase.rpc(
    "teacher_create_student_for_class",
    {
      p_class_id: classId,
      p_first_name: first.value,
      p_last_name: last.value,
      p_preferred_name: preferredName,
    },
  );

  if (createError || !studentId) {
    return {
      ok: false,
      message: createError?.message || "Could not create the student.",
    };
  }

  await recordAuditEvent({
    action: "teacher_student_created",
    actorUserId: gate.userId,
    metadata: {
      studentId,
      classId,
      enrollmentStatus: "active",
    },
  });

  revalidateTeacherClassPaths(classId, studentId);

  return {
    ok: true,
    message: "Student added to your class roster.",
    studentId,
  };
}

export async function teacherBulkCreateStudentsAction(
  _prev: TeacherBulkRosterState | undefined,
  formData: FormData,
): Promise<TeacherBulkRosterState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const classId = String(formData.get("classId") ?? "");
  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const rawPaste = String(formData.get("rosterPaste") ?? "");
  const parsed = parseBulkRosterPaste(rawPaste);
  if (!parsed.ok) {
    return { ok: false, message: parsed.errors.join(" ") };
  }

  const failed: { line: number; message: string }[] = [];
  const payload: { line: number; first_name: string; last_name: string }[] = [];

  for (const row of parsed.rows) {
    const first = trimRequired(row.firstName, "First name");
    if (!first.ok) {
      failed.push({ line: row.line, message: first.message });
      continue;
    }
    const last = trimRequired(row.lastName, "Last name");
    if (!last.ok) {
      failed.push({ line: row.line, message: last.message });
      continue;
    }

    payload.push({
      line: row.line,
      first_name: first.value,
      last_name: last.value,
    });
  }

  let createdCount = 0;
  const createdStudentIds: string[] = [];

  if (payload.length > 0) {
    const { data: bulkResult, error: bulkError } = await gate.supabase.rpc(
      "teacher_bulk_create_students_for_class",
      {
        p_class_id: classId,
        p_students: payload,
      },
    );

    if (bulkError) {
      return { ok: false, message: bulkError.message };
    }

    const result = bulkResult as TeacherBulkCreateRpcResult | null;
    createdCount = result?.created_count ?? 0;
    if (Array.isArray(result?.created_ids)) {
      createdStudentIds.push(...result.created_ids);
    }
    if (Array.isArray(result?.failed)) {
      for (const item of result.failed) {
        if (
          item &&
          typeof item === "object" &&
          "line" in item &&
          "message" in item &&
          typeof item.line === "number" &&
          typeof item.message === "string"
        ) {
          failed.push({ line: item.line, message: item.message });
        }
      }
    }
  }

  if (createdCount > 0) {
    await recordAuditEvent({
      action: "teacher_roster_bulk_created",
      actorUserId: gate.userId,
      metadata: {
        classId,
        createdCount,
        failedCount: failed.length,
        studentIds: createdStudentIds.slice(0, 50),
      },
    });
    revalidateTeacherClassPaths(classId);
  }

  if (createdCount === 0) {
    return {
      ok: false,
      message: "No students were added. Fix the rows below and try again.",
      failed,
    };
  }

  const summary =
    failed.length === 0
      ? `Added ${createdCount} student${createdCount === 1 ? "" : "s"} to the roster.`
      : `Added ${createdCount} student${createdCount === 1 ? "" : "s"}; ${failed.length} row${failed.length === 1 ? "" : "s"} failed.`;

  return {
    ok: true,
    message: summary,
    createdCount,
    failed,
  };
}

export async function teacherUpdateStudentAction(
  _prev: TeacherStudentMutationState | undefined,
  formData: FormData,
): Promise<TeacherStudentMutationState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student id." };
  }

  const gate = await requireTeacherCanAccessStudent(studentId);
  if (!gate.ok) return gate;

  const first = trimRequired(String(formData.get("firstName") ?? ""), "First name");
  if (!first.ok) return first;

  const last = trimRequired(String(formData.get("lastName") ?? ""), "Last name");
  if (!last.ok) return last;

  const preferredName = trimOptional(String(formData.get("preferredName") ?? ""), NAME_MAX);

  const { data: beforeStudent, error: beforeStudentError } = await gate.supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name")
    .eq("id", studentId)
    .maybeSingle();

  if (beforeStudentError) {
    return { ok: false, message: beforeStudentError.message };
  }
  if (!beforeStudent) {
    return { ok: false, message: "Student not found." };
  }

  const { error: updStudentError } = await gate.supabase
    .from("students")
    .update({
      first_name: first.value,
      last_name: last.value,
      preferred_name: preferredName,
    })
    .eq("id", studentId);

  if (updStudentError) {
    return { ok: false, message: updStudentError.message };
  }

  const changed: string[] = [];
  if (beforeStudent.first_name !== first.value) changed.push("first_name");
  if (beforeStudent.last_name !== last.value) changed.push("last_name");
  const prevPref = beforeStudent.preferred_name?.trim() || "";
  const newPref = preferredName ?? "";
  if (prevPref !== newPref) changed.push("preferred_name");

  await recordAuditEvent({
    action: "teacher_student_updated",
    actorUserId: gate.userId,
    metadata: {
      studentId,
      changedSummary:
        changed.length > 0 ? changed.join(", ") : "no_field_changes_detected",
    },
  });

  revalidatePath(`/dashboard/teacher/students/${studentId}`, "layout");

  return { ok: true, message: "Student updated.", studentId };
}
