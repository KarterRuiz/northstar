"use server";

import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit";
import { requireCanCreateIntervention } from "@/lib/auth/intervention-access";
import { requireTeacherCanAccessStudent } from "@/lib/auth/teacher-class-access";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isStudentId, isUuid } from "@/lib/students/uuid";

import type { CreateInterventionInput } from "./schema";
import {
  interventionSeverities,
  interventionStatuses,
  interventionTypes,
  type InterventionStatus,
} from "./schema";

export type InterventionActionResult =
  | { ok: true; interventionId: string }
  | { ok: false; message: string };

export type SimpleInterventionResult = { ok: true } | { ok: false; message: string };

function revalidateInterventionPaths(studentId: string) {
  revalidatePath("/dashboard/teacher/interventions");
  revalidatePath("/dashboard/admin/attendance");
  revalidatePath(`/dashboard/teacher/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/admin/students/${studentId}`, "layout");
}

function validateCreateInput(
  input: CreateInterventionInput,
): string | null {
  if (!isStudentId(input.studentId)) return "Invalid student id.";
  if (!isUuid(input.classId)) return "Invalid class id.";
  if (!interventionTypes.includes(input.interventionType)) return "Invalid intervention type.";
  if (!interventionSeverities.includes(input.severity)) return "Invalid severity.";
  if (!interventionStatuses.includes(input.status)) return "Invalid status.";
  if (!input.title.trim()) return "Title is required.";
  return null;
}

export async function createInterventionAction(
  input: CreateInterventionInput,
): Promise<InterventionActionResult> {
  const validationError = validateCreateInput(input);
  if (validationError) return { ok: false, message: validationError };

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const gate = await requireCanCreateIntervention({
    studentId: input.studentId,
    classId: input.classId,
  });
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;

  const { data: klass, error: classError } = await supabase
    .from("classes")
    .select("school_year_id")
    .eq("id", input.classId)
    .maybeSingle();

  if (classError || !klass?.school_year_id) {
    return {
      ok: false,
      message: classError?.message ?? "Class not found or missing school year.",
    };
  }

  const resolvedAt =
    input.status === "resolved" ? new Date().toISOString() : null;

  const { data: inserted, error } = await supabase
    .from("student_interventions")
    .insert({
      student_id: input.studentId,
      class_id: input.classId,
      school_year_id: klass.school_year_id,
      intervention_type: input.interventionType,
      status: input.status,
      severity: input.severity,
      title: input.title.trim(),
      description: input.description.trim(),
      created_by: userId,
      follow_up_date: input.followUpDate || null,
      resolved_at: resolvedAt,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { ok: false, message: error?.message ?? "Could not create intervention." };
  }

  await recordAuditEvent({
    action: "intervention_created",
    actorUserId: userId,
    metadata: {
      studentId: input.studentId,
      classId: input.classId,
      interventionId: inserted.id,
      interventionType: input.interventionType,
      status: input.status,
    },
  });

  revalidateInterventionPaths(input.studentId);
  return { ok: true, interventionId: inserted.id };
}

async function updateInterventionStatus(
  interventionId: string,
  studentId: string,
  status: InterventionStatus,
  auditAction: "intervention_resolved" | "intervention_escalated" | "intervention_updated",
): Promise<SimpleInterventionResult> {
  if (!isUuid(interventionId) || !isStudentId(studentId)) {
    return { ok: false, message: "Invalid id." };
  }

  const gate = await requireTeacherCanAccessStudent(studentId);
  if (!gate.ok) return gate;

  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;

  const { error } = await gate.supabase
    .from("student_interventions")
    .update({
      status,
      resolved_at: resolvedAt,
    })
    .eq("id", interventionId)
    .eq("student_id", studentId);

  if (error) return { ok: false, message: error.message };

  await recordAuditEvent({
    action: auditAction,
    actorUserId: gate.userId,
    metadata: { studentId, interventionId, status },
  });

  revalidateInterventionPaths(studentId);
  return { ok: true };
}

export async function resolveInterventionAction(args: {
  interventionId: string;
  studentId: string;
}): Promise<SimpleInterventionResult> {
  return updateInterventionStatus(
    args.interventionId,
    args.studentId,
    "resolved",
    "intervention_resolved",
  );
}

export async function escalateInterventionAction(args: {
  interventionId: string;
  studentId: string;
}): Promise<SimpleInterventionResult> {
  return updateInterventionStatus(
    args.interventionId,
    args.studentId,
    "escalated",
    "intervention_escalated",
  );
}
