"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import { requireTeacherAssignedToClass } from "@/lib/auth/teacher-class-access";
import { isStudentId, isUuid } from "@/lib/students/uuid";

import type { ScoreStatus } from "./calculations";
import {
  parsePointsEarned,
  validateAssignmentInput,
  validateCategoryInput,
  type AssignmentInput,
  type CategoryInput,
  type ScoreRowInput,
} from "./schema";

export type GradebookActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

function gradebookPath(classId: string) {
  return `/dashboard/teacher/classes/${classId}/gradebook`;
}

/** Scoped invalidation — hub route only redirects; avoid extra layout churn. */
function revalidateGradebook(classId: string) {
  revalidatePath(gradebookPath(classId), "page");
  revalidatePath(`/dashboard/teacher/classes/${classId}`, "page");
}

async function loadAssignmentClassId(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createServerSupabaseClient>
  >,
  assignmentId: string,
): Promise<{ classId: string; teacherProfileId: string } | null> {
  const { data, error } = await supabase
    .from("gradebook_assignments")
    .select("class_id, teacher_profile_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    classId: data.class_id,
    teacherProfileId: data.teacher_profile_id,
  };
}

export async function createGradebookCategoryAction(args: {
  classId: string;
  input: CategoryInput;
}): Promise<GradebookActionResult> {
  const { classId, input } = args;
  const validation = validateCategoryInput(input);
  if (validation) return { ok: false, message: validation };

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const { data: maxSortRow } = await supabase
    .from("gradebook_categories")
    .select("sort_order")
    .eq("class_id", classId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxSortRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("gradebook_categories")
    .insert({
      class_id: classId,
      teacher_profile_id: userId,
      name: input.name.trim(),
      weight_percent: Number(input.weightPercent),
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Could not create category." };
  }

  await recordAuditEvent({
    action: "gradebook_category_created",
    actorUserId: userId,
    metadata: { classId, categoryId: data.id },
  });
  revalidateGradebook(classId);
  return { ok: true, id: data.id };
}

export async function updateGradebookCategoryAction(args: {
  classId: string;
  categoryId: string;
  input: CategoryInput;
}): Promise<GradebookActionResult> {
  const { classId, categoryId, input } = args;
  if (!isUuid(categoryId)) return { ok: false, message: "Invalid category id." };
  const validation = validateCategoryInput(input);
  if (validation) return { ok: false, message: validation };

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;
  const { error } = await supabase
    .from("gradebook_categories")
    .update({
      name: input.name.trim(),
      weight_percent: Number(input.weightPercent),
    })
    .eq("id", categoryId)
    .eq("class_id", classId)
    .eq("teacher_profile_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidateGradebook(classId);
  return { ok: true, id: categoryId };
}

export async function deleteGradebookCategoryAction(args: {
  classId: string;
  categoryId: string;
}): Promise<GradebookActionResult> {
  const { classId, categoryId } = args;
  if (!isUuid(categoryId)) return { ok: false, message: "Invalid category id." };

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;
  const { error } = await supabase
    .from("gradebook_categories")
    .delete()
    .eq("id", categoryId)
    .eq("class_id", classId)
    .eq("teacher_profile_id", userId);

  if (error) return { ok: false, message: error.message };
  revalidateGradebook(classId);
  return { ok: true };
}

export async function createGradebookAssignmentAction(args: {
  classId: string;
  input: AssignmentInput;
}): Promise<GradebookActionResult> {
  const { classId, input } = args;
  const validation = validateAssignmentInput(input);
  if (validation) return { ok: false, message: validation };
  if (!isUuid(input.categoryId)) {
    return { ok: false, message: "Invalid category." };
  }

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const { data: cat, error: catError } = await supabase
    .from("gradebook_categories")
    .select("id")
    .eq("id", input.categoryId)
    .eq("class_id", classId)
    .maybeSingle();

  if (catError || !cat) {
    return { ok: false, message: "Category not found for this class." };
  }

  const { data, error } = await supabase
    .from("gradebook_assignments")
    .insert({
      class_id: classId,
      category_id: input.categoryId,
      teacher_profile_id: userId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      points_possible: Number(input.pointsPossible),
      due_date: input.dueDate.trim() || null,
      term: input.term || null,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Could not create assignment." };
  }

  await recordAuditEvent({
    action: "gradebook_assignment_created",
    actorUserId: userId,
    metadata: {
      classId,
      assignmentId: data.id,
      categoryId: input.categoryId,
    },
  });
  revalidateGradebook(classId);
  return { ok: true, id: data.id };
}

export async function updateGradebookAssignmentAction(args: {
  classId: string;
  assignmentId: string;
  input: AssignmentInput;
}): Promise<GradebookActionResult> {
  const { classId, assignmentId, input } = args;
  if (!isUuid(assignmentId)) return { ok: false, message: "Invalid assignment id." };
  const validation = validateAssignmentInput(input);
  if (validation) return { ok: false, message: validation };
  if (!isUuid(input.categoryId)) {
    return { ok: false, message: "Invalid category." };
  }

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const { data: cat, error: catError } = await supabase
    .from("gradebook_categories")
    .select("id")
    .eq("id", input.categoryId)
    .eq("class_id", classId)
    .maybeSingle();

  if (catError || !cat) {
    return { ok: false, message: "Category not found for this class." };
  }

  const { error } = await supabase
    .from("gradebook_assignments")
    .update({
      category_id: input.categoryId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      points_possible: Number(input.pointsPossible),
      due_date: input.dueDate.trim() || null,
      term: input.term || null,
    })
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .eq("teacher_profile_id", userId);

  if (error) return { ok: false, message: error.message };

  await recordAuditEvent({
    action: "gradebook_assignment_updated",
    actorUserId: userId,
    metadata: {
      classId,
      assignmentId,
      categoryId: input.categoryId,
    },
  });
  revalidateGradebook(classId);
  return { ok: true, id: assignmentId };
}

export async function deleteGradebookAssignmentAction(args: {
  classId: string;
  assignmentId: string;
}): Promise<GradebookActionResult> {
  const { classId, assignmentId } = args;
  if (!isUuid(assignmentId)) return { ok: false, message: "Invalid assignment id." };

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;
  const { error } = await supabase
    .from("gradebook_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("class_id", classId)
    .eq("teacher_profile_id", userId);

  if (error) return { ok: false, message: error.message };

  await recordAuditEvent({
    action: "gradebook_assignment_deleted",
    actorUserId: userId,
    metadata: { classId, assignmentId },
  });
  revalidateGradebook(classId);
  return { ok: true };
}

export async function saveGradebookScoreAction(args: {
  classId: string;
  assignmentId: string;
  row: ScoreRowInput;
}): Promise<GradebookActionResult> {
  return saveGradebookScoresBulkAction({
    classId: args.classId,
    assignmentId: args.assignmentId,
    rows: [args.row],
  });
}

const SCORE_SAVE_VALIDATE_CHUNK = 14;

export async function saveGradebookScoresBulkAction(args: {
  classId: string;
  assignmentId: string;
  rows: ScoreRowInput[];
}): Promise<GradebookActionResult> {
  const { classId, assignmentId, rows } = args;
  if (!isUuid(assignmentId)) return { ok: false, message: "Invalid assignment id." };
  if (!rows.length) return { ok: false, message: "No scores to save." };

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const assignmentMeta = await loadAssignmentClassId(supabase, assignmentId);
  if (!assignmentMeta || assignmentMeta.classId !== classId) {
    return { ok: false, message: "Assignment not found for this class." };
  }
  if (assignmentMeta.teacherProfileId !== userId) {
    return { ok: false, message: "You can only enter scores for your assignments." };
  }

  const upserts: {
    assignment_id: string;
    student_id: string;
    points_earned: number | null;
    status: ScoreStatus;
    feedback: string | null;
  }[] = [];

  for (let i = 0; i < rows.length; i += SCORE_SAVE_VALIDATE_CHUNK) {
    const chunk = rows.slice(i, i + SCORE_SAVE_VALIDATE_CHUNK);
    const chunkUpserts = await Promise.all(
      chunk.map(async (row) => {
        if (!isStudentId(row.studentId)) {
          return { ok: false as const, message: "Invalid student id in score row." };
        }

        const [{ data: canAccess, error: accessErr }, { data: active, error: enrollErr }] =
          await Promise.all([
            supabase.rpc("teacher_can_access_student", { p_student_id: row.studentId }),
            supabase.rpc("student_is_active_in_class", {
              p_student_id: row.studentId,
              p_class_id: classId,
            }),
          ]);

        if (accessErr) return { ok: false as const, message: accessErr.message };
        if (canAccess !== true) {
          return { ok: false as const, message: "You are not assigned to this student." };
        }
        if (enrollErr) return { ok: false as const, message: enrollErr.message };
        if (active !== true) {
          return {
            ok: false as const,
            message: "Student is not actively enrolled in this class.",
          };
        }

        const parsed = parsePointsEarned(row.pointsEarned, row.status);
        if (parsed === "invalid") {
          return {
            ok: false as const,
            message: "Points earned must be a non-negative number.",
          };
        }

        return {
          ok: true as const,
          upsert: {
            assignment_id: assignmentId,
            student_id: row.studentId,
            points_earned: parsed,
            status: row.status,
            feedback: row.feedback.trim() || null,
          },
        };
      }),
    );

    for (const r of chunkUpserts) {
      if (!r.ok) return r;
      upserts.push(r.upsert);
    }
  }

  const { error } = await supabase.from("gradebook_scores").upsert(upserts, {
    onConflict: "assignment_id,student_id",
  });

  if (error) return { ok: false, message: error.message };

  await recordAuditEvent({
    action: "gradebook_scores_updated",
    actorUserId: userId,
    metadata: {
      classId,
      assignmentId,
      scoreCount: upserts.length,
    },
  });
  // GradebookView merges scores locally; skip revalidatePath here to avoid
  // RSC refresh, scroll jump, and losing in-progress UI state.
  return { ok: true };
}
