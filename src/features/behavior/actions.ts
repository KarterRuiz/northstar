"use server";

import { revalidatePath } from "next/cache";

import {
  behaviorSeverities,
  supportCategoryToBehaviorType,
  type CreateBehaviorRecordInput,
} from "./schema";
import { requireTeacherCanAccessStudent } from "@/lib/auth/teacher-class-access";
import { isStudentId, isUuid } from "@/lib/students/uuid";
import { supportMomentCategories } from "@/lib/student-support/quick-reasons";

export type BehaviorActionResult =
  | { ok: true; recordId: string }
  | { ok: false; message: string };

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function revalidateBehaviorPaths(studentId: string, classId: string) {
  revalidatePath("/dashboard/teacher/behavior", "page");
  revalidatePath("/dashboard/teacher/interventions", "page");
  revalidatePath("/dashboard/teacher", "page");
  revalidatePath(`/dashboard/teacher/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/teacher/classes/${classId}`, "page");
}

const MAX_TAGS = 12;
const MAX_TAG_LEN = 64;

function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const s = t.trim().slice(0, MAX_TAG_LEN);
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

export async function createBehaviorRecordAction(
  input: CreateBehaviorRecordInput,
): Promise<BehaviorActionResult> {
  if (!isStudentId(input.studentId)) return { ok: false, message: "Invalid student id." };
  if (!isUuid(input.classId)) return { ok: false, message: "Invalid class id." };
  if (!isIsoDate(input.behaviorDate)) {
    return { ok: false, message: "Support date must be YYYY-MM-DD." };
  }
  if (!supportMomentCategories.includes(input.supportCategory)) {
    return { ok: false, message: "Invalid support category." };
  }
  if (!behaviorSeverities.includes(input.severity)) {
    return { ok: false, message: "Invalid support level." };
  }
  if (!input.quickReason.trim()) {
    return { ok: false, message: "Choose a quick reason." };
  }
  if (!input.generatedSummary.trim()) {
    return { ok: false, message: "Summary is required." };
  }

  const gate = await requireTeacherCanAccessStudent(input.studentId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const { data: klass, error: classError } = await supabase
    .from("classes")
    .select("school_years ( label )")
    .eq("id", input.classId)
    .maybeSingle();

  if (classError) return { ok: false, message: classError.message };

  const schoolYearEmbed = klass?.school_years;
  const schoolYearLabel = Array.isArray(schoolYearEmbed)
    ? schoolYearEmbed[0]?.label
    : schoolYearEmbed?.label;

  if (!schoolYearLabel) {
    return { ok: false, message: "Could not resolve school year for this class." };
  }

  const behaviorType = supportCategoryToBehaviorType(input.supportCategory);
  const title = input.title.trim().slice(0, 200);
  const generated = input.generatedSummary.trim();
  const teacherNote = input.teacherNote?.trim() || null;
  const description = teacherNote ?? "";

  const { data, error } = await supabase
    .from("behavior_records")
    .insert({
      student_id: input.studentId,
      class_id: input.classId,
      school_year: schoolYearLabel,
      behavior_date: input.behaviorDate,
      behavior_type: behaviorType,
      severity: input.severity,
      title,
      description,
      action_taken: input.actionTaken?.trim() || null,
      recorded_by: userId,
      support_category: input.supportCategory,
      support_tags: normalizeTags(input.supportTags),
      generated_summary: generated,
      teacher_note: teacherNote,
      follow_up_required: input.followUpRequired,
      parent_contacted: input.parentContacted,
      time_of_day: input.timeOfDay?.trim() || null,
      related_subject: input.relatedSubject?.trim() || null,
      quick_reason: input.quickReason.trim(),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };

  revalidateBehaviorPaths(input.studentId, input.classId);
  return { ok: true, recordId: data.id };
}
