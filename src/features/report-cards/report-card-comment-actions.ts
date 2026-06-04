"use server";

import { revalidatePath } from "next/cache";

import {
  requireTeacherAssignedToClass,
  requireTeacherCanAccessStudent,
} from "@/lib/auth/teacher-class-access";
import { isReportCardTerm } from "@/lib/report-cards/constants";
import { isStudentId, isUuid } from "@/lib/students/uuid";

export type ReportCardCommentActionResult =
  | { ok: true }
  | { ok: false; message: string };

function revalidateReportCardPaths(args: {
  classId: string;
  studentId: string;
}) {
  revalidatePath("/dashboard/teacher/report-cards", "page");
  revalidatePath(
    `/dashboard/teacher/report-cards/preview/${args.studentId}`,
    "page",
  );
  revalidatePath(`/dashboard/teacher/classes/${args.classId}/gradebook`, "page");
}

async function requireTeacherForComment(args: {
  studentId: string;
  classId: string;
}): Promise<
  | {
      ok: true;
      userId: string;
      supabase: Awaited<
        ReturnType<
          typeof import("@/lib/supabase/server").createServerSupabaseClient
        >
      >;
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
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createServerSupabaseClient>
  >,
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

export async function saveReportCardCommentDraftAction(formData: FormData): Promise<ReportCardCommentActionResult> {
  const studentId = String(formData.get("studentId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const term = String(formData.get("term") ?? "");
  const narrativeComment = String(formData.get("narrativeComment") ?? "").trim();

  if (!isReportCardTerm(term)) {
    return { ok: false, message: "Invalid term." };
  }

  const gate = await requireTeacherForComment({ studentId, classId });
  if (!gate.ok) return gate;

  const schoolYearId = await loadClassSchoolYearId(gate.supabase, classId);
  if (!schoolYearId) {
    return { ok: false, message: "Class has no school year." };
  }

  const { data: existing } = await gate.supabase
    .from("report_card_comments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("school_year_id", schoolYearId)
    .eq("term", term)
    .maybeSingle();

  if (existing?.status === "complete") {
    return { ok: false, message: "Comment is marked complete. Reopen is not supported yet." };
  }

  if (existing?.id) {
    const { error } = await gate.supabase
      .from("report_card_comments")
      .update({
        narrative_comment: narrativeComment,
        status: "draft",
      })
      .eq("id", existing.id);

    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await gate.supabase.from("report_card_comments").insert({
      student_id: studentId,
      class_id: classId,
      school_year_id: schoolYearId,
      term,
      narrative_comment: narrativeComment,
      status: "draft",
      teacher_profile_id: gate.userId,
    });

    if (error) return { ok: false, message: error.message };
  }

  revalidateReportCardPaths({ classId, studentId });
  return { ok: true };
}

export async function markReportCardCommentCompleteAction(
  formData: FormData,
): Promise<ReportCardCommentActionResult> {
  const studentId = String(formData.get("studentId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const term = String(formData.get("term") ?? "");
  const narrativeComment = String(formData.get("narrativeComment") ?? "").trim();

  if (!isReportCardTerm(term)) {
    return { ok: false, message: "Invalid term." };
  }
  if (!narrativeComment) {
    return { ok: false, message: "Add a narrative comment before marking complete." };
  }

  const gate = await requireTeacherForComment({ studentId, classId });
  if (!gate.ok) return gate;

  const schoolYearId = await loadClassSchoolYearId(gate.supabase, classId);
  if (!schoolYearId) {
    return { ok: false, message: "Class has no school year." };
  }

  const { data: existing } = await gate.supabase
    .from("report_card_comments")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("school_year_id", schoolYearId)
    .eq("term", term)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await gate.supabase
      .from("report_card_comments")
      .update({
        narrative_comment: narrativeComment,
        status: "complete",
      })
      .eq("id", existing.id);

    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await gate.supabase.from("report_card_comments").insert({
      student_id: studentId,
      class_id: classId,
      school_year_id: schoolYearId,
      term,
      narrative_comment: narrativeComment,
      status: "complete",
      teacher_profile_id: gate.userId,
    });

    if (error) return { ok: false, message: error.message };
  }

  revalidateReportCardPaths({ classId, studentId });
  return { ok: true };
}
