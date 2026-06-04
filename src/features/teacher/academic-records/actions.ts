"use server";

import { revalidatePath } from "next/cache";

import { canModerateAcademicRecords } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import {
  requireTeacherAssignedToClass,
  requireTeacherCanAccessStudent,
} from "@/lib/auth/teacher-class-access";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId, isUuid } from "@/lib/students/uuid";

import { academicFieldsToRow, rowToAcademicFields } from "./field-map";
import {
  emptyAcademicRecord,
  validateAcademicRecordForDraft,
  validateAcademicRecordForSubmit,
  type AcademicRecordFields,
} from "./schema";

export type AcademicRecordActionResult =
  | { ok: true; recordId: string }
  | { ok: false; message: string };

type RecordStatus = "draft" | "submitted" | "reviewed" | "archived";

type AcademicRecordRow = {
  id: string;
  student_id: string;
  class_id: string;
  teacher_profile_id: string;
  school_year_id: string;
  status: RecordStatus;
};

function revalidateAcademicRecordPaths(args: {
  studentId: string;
  classId: string;
}) {
  const { studentId, classId } = args;
  revalidatePath(`/dashboard/teacher/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/admin/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/principal/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/vice_principal/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/registrar/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/teacher/classes/${classId}`, "page");
  revalidatePath("/dashboard/admin/academic-review", "page");
  revalidatePath("/dashboard/principal/academic-review", "page");
  revalidatePath("/dashboard/vice_principal/academic-review", "page");
}

async function requireTeacherForClassStudent(args: {
  studentId: string;
  classId: string;
}): Promise<
  | {
      ok: true;
      userId: string;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
    }
  | { ok: false; message: string }
> {
  const { studentId, classId } = args;
  if (!isStudentId(studentId) || !isUuid(classId)) {
    return { ok: false, message: "Invalid id." };
  }
  const classGate = await requireTeacherAssignedToClass(classId);
  if (!classGate.ok) return classGate;

  const studentGate = await requireTeacherCanAccessStudent(studentId);
  if (!studentGate.ok) return studentGate;

  return { ok: true, userId: classGate.userId, supabase: classGate.supabase };
}

async function loadClassSchoolYearId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  classId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("school_year_id")
    .eq("id", classId)
    .maybeSingle();
  if (error || !data?.school_year_id) return null;
  return data.school_year_id;
}

async function requireModerator(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> }
  | { ok: false; message: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }
  const role = await getProfileRole(user.id);
  if (!role || !canModerateAcademicRecords(role)) {
    return { ok: false, message: "You do not have permission to moderate academic records." };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, userId: user.id, supabase };
}

/** Persists or updates a draft academic record (assigned class roster). */
export async function saveAcademicRecordDraft(args: {
  studentId: string;
  classId: string;
  recordId?: string;
  data: AcademicRecordFields;
}): Promise<AcademicRecordActionResult> {
  const { studentId, classId, recordId, data } = args;
  const validation = validateAcademicRecordForDraft(data);
  if (validation) {
    return { ok: false, message: validation };
  }

  const gate = await requireTeacherForClassStudent({ studentId, classId });
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;
  const payload = academicFieldsToRow(data);
  const schoolYearId = await loadClassSchoolYearId(supabase, classId);
  if (!schoolYearId) {
    return { ok: false, message: "Could not resolve school year for this class." };
  }

  if (!recordId) {
    const { data: inserted, error } = await supabase
      .from("academic_records")
      .insert({
        student_id: studentId,
        class_id: classId,
        teacher_profile_id: userId,
        school_year_id: schoolYearId,
        status: "draft",
        ...payload,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      return { ok: false, message: error?.message ?? "Could not save draft." };
    }
    await recordAuditEvent({
      action: "academic_record_created",
      actorUserId: userId,
      metadata: { studentId, recordId: inserted.id, classId },
    });
    revalidateAcademicRecordPaths({ studentId, classId });
    return { ok: true, recordId: inserted.id };
  }

  if (!isUuid(recordId)) {
    return { ok: false, message: "Invalid record id." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("academic_records")
    .select("id, student_id, class_id, teacher_profile_id, status")
    .eq("id", recordId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Record not found." };
  }

  const row = existing as AcademicRecordRow;
  if (row.student_id !== studentId || row.class_id !== classId) {
    return { ok: false, message: "Record does not match this student and class." };
  }
  if (row.teacher_profile_id !== userId) {
    return { ok: false, message: "You can only edit your own records." };
  }
  if (row.status !== "draft") {
    return { ok: false, message: "This record can no longer be edited." };
  }

  const { error: upError } = await supabase
    .from("academic_records")
    .update({ ...payload, status: "draft" })
    .eq("id", recordId);

  if (upError) {
    return { ok: false, message: upError.message };
  }
  await recordAuditEvent({
    action: "academic_record_updated",
    actorUserId: userId,
    metadata: { studentId, recordId, classId },
  });
  revalidateAcademicRecordPaths({ studentId, classId });
  return { ok: true, recordId };
}

/** Submits an academic record for leadership review. */
export async function submitAcademicRecord(args: {
  studentId: string;
  classId: string;
  recordId?: string;
  data: AcademicRecordFields;
}): Promise<AcademicRecordActionResult> {
  const { studentId, classId, recordId, data } = args;
  const validation = validateAcademicRecordForSubmit(data);
  if (validation) {
    return { ok: false, message: validation };
  }

  const gate = await requireTeacherForClassStudent({ studentId, classId });
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;
  const payload = academicFieldsToRow(data);
  const schoolYearId = await loadClassSchoolYearId(supabase, classId);
  if (!schoolYearId) {
    return { ok: false, message: "Could not resolve school year for this class." };
  }

  let id = recordId;
  if (!id) {
    const { data: inserted, error } = await supabase
      .from("academic_records")
      .insert({
        student_id: studentId,
        class_id: classId,
        teacher_profile_id: userId,
        school_year_id: schoolYearId,
        status: "draft",
        ...payload,
      })
      .select("id")
      .single();
    if (error || !inserted?.id) {
      return { ok: false, message: error?.message ?? "Could not create record." };
    }
    id = inserted.id;
  } else if (!isUuid(id)) {
    return { ok: false, message: "Invalid record id." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("academic_records")
    .select("id, student_id, class_id, teacher_profile_id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Record not found." };
  }
  const row = existing as AcademicRecordRow;
  if (row.student_id !== studentId || row.class_id !== classId) {
    return { ok: false, message: "Record does not match this student and class." };
  }
  if (row.teacher_profile_id !== userId) {
    return { ok: false, message: "You can only submit your own records." };
  }
  if (row.status !== "draft") {
    return { ok: false, message: "Only draft records can be submitted." };
  }

  const { error: upError } = await supabase
    .from("academic_records")
    .update({ ...payload, status: "submitted" })
    .eq("id", id);

  if (upError) {
    return { ok: false, message: upError.message };
  }
  await recordAuditEvent({
    action: "academic_record_submitted",
    actorUserId: userId,
    metadata: { studentId, recordId: id, classId },
  });
  revalidateAcademicRecordPaths({ studentId, classId });
  return { ok: true, recordId: id };
}

export type LoadedAcademicRecordForForm =
  | {
      ok: true;
      recordId?: string;
      studentId: string;
      classId: string;
      status: RecordStatus;
      fields: AcademicRecordFields;
      editable: boolean;
    }
  | { ok: false; message: string };

export async function loadAcademicRecordForForm(args: {
  studentId: string;
  classId: string;
  recordId?: string;
}): Promise<LoadedAcademicRecordForForm> {
  const { studentId, classId, recordId } = args;
  const gate = await requireTeacherForClassStudent({ studentId, classId });
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  const { supabase, userId } = gate;

  if (!recordId) {
    return {
      ok: true,
      studentId,
      classId,
      status: "draft",
      fields: emptyAcademicRecord(),
      editable: true,
    };
  }

  if (!isUuid(recordId)) {
    return { ok: false, message: "Invalid record id." };
  }

  const { data: row, error } = await supabase
    .from("academic_records")
    .select(
      "id, student_id, class_id, teacher_profile_id, status, subject, term, score_or_grade, performance_level, teacher_comment, work_habits",
    )
    .eq("id", recordId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: error?.message ?? "Record not found." };
  }
  const r = row as AcademicRecordRow & {
    subject: string;
    term: string | null;
    score_or_grade: string | null;
    performance_level: string | null;
    teacher_comment: string | null;
    work_habits: string | null;
  };
  if (r.student_id !== studentId || r.class_id !== classId) {
    return { ok: false, message: "Record does not match this student and class." };
  }
  if (r.teacher_profile_id !== userId) {
    return { ok: false, message: "You can only open your own academic records here." };
  }

  const status = r.status;
  const editable = status === "draft";

  return {
    ok: true,
    recordId: r.id,
    studentId,
    classId,
    status,
    fields: rowToAcademicFields(r),
    editable,
  };
}

export type SimpleActionResult = { ok: true } | { ok: false; message: string };

export async function reviewAcademicRecordAction(args: {
  recordId: string;
}): Promise<SimpleActionResult> {
  const { recordId } = args;
  if (!isUuid(recordId)) {
    return { ok: false, message: "Invalid record id." };
  }
  const gate = await requireModerator();
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;

  const { data: existing, error: loadError } = await supabase
    .from("academic_records")
    .select("id, student_id, class_id, status")
    .eq("id", recordId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Record not found." };
  }
  const row = existing as { id: string; student_id: string; class_id: string; status: RecordStatus };
  if (row.status !== "submitted") {
    return { ok: false, message: "Only submitted records can be marked reviewed." };
  }

  const { error } = await supabase
    .from("academic_records")
    .update({ status: "reviewed" })
    .eq("id", recordId);

  if (error) return { ok: false, message: error.message };
  await recordAuditEvent({
    action: "academic_record_reviewed",
    actorUserId: userId,
    metadata: { studentId: row.student_id, recordId, classId: row.class_id },
  });
  revalidateAcademicRecordPaths({
    studentId: row.student_id,
    classId: row.class_id,
  });
  return { ok: true };
}

export async function archiveAcademicRecordAction(args: {
  recordId: string;
}): Promise<SimpleActionResult> {
  const { recordId } = args;
  if (!isUuid(recordId)) {
    return { ok: false, message: "Invalid record id." };
  }
  const gate = await requireModerator();
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;

  const { data: existing, error: loadError } = await supabase
    .from("academic_records")
    .select("id, student_id, class_id, status")
    .eq("id", recordId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Record not found." };
  }
  const row = existing as { id: string; student_id: string; class_id: string; status: RecordStatus };
  if (row.status === "archived") {
    return { ok: true };
  }

  const { error } = await supabase
    .from("academic_records")
    .update({ status: "archived" })
    .eq("id", recordId);

  if (error) return { ok: false, message: error.message };
  await recordAuditEvent({
    action: "academic_record_updated",
    actorUserId: userId,
    metadata: {
      studentId: row.student_id,
      recordId,
      classId: row.class_id,
      changedSummary: "archived",
    },
  });
  revalidateAcademicRecordPaths({
    studentId: row.student_id,
    classId: row.class_id,
  });
  return { ok: true };
}
