"use server";

import { revalidatePath } from "next/cache";

import { canModerateTransitionNotes } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

import { rowToTransitionFields, transitionFieldsToRow } from "./field-map";
import { emptyTransitionNote, type TransitionNoteFields } from "./schema";

export type TransitionNoteActionResult =
  | { ok: true; noteId: string }
  | { ok: false; message: string };

type NoteStatus = "draft" | "submitted" | "reviewed" | "archived" | "reopened";

type TransitionNoteRow = {
  id: string;
  student_id: string;
  author_profile_id: string;
  status: NoteStatus;
};

function revalidateStudentTransitionPaths(studentId: string) {
  revalidatePath(`/dashboard/teacher/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/admin/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/principal/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/vice_principal/students/${studentId}`, "layout");
  revalidatePath(`/dashboard/registrar/students/${studentId}`, "layout");
}

async function requireTeacherForStudent(
  studentId: string,
): Promise<
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
  if (role !== "teacher") {
    return { ok: false, message: "Only teachers can edit transition notes." };
  }
  const supabase = await createServerSupabaseClient();
  const { data: access, error } = await supabase.rpc("teacher_can_access_student", {
    p_student_id: studentId,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  if (access !== true) {
    return { ok: false, message: "You are not assigned to this student." };
  }
  return { ok: true, userId: user.id, supabase };
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
  if (!role || !canModerateTransitionNotes(role)) {
    return { ok: false, message: "You do not have permission to moderate transition notes." };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, userId: user.id, supabase };
}

/** Persists or updates a draft transition note (teacher, assigned roster). */
export async function saveTransitionNoteDraft(
  studentId: string,
  noteId: string | undefined,
  data: TransitionNoteFields,
): Promise<TransitionNoteActionResult> {
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student id." };
  }
  const gate = await requireTeacherForStudent(studentId);
  if (!gate.ok) return gate;

  const { supabase, userId } = gate;
  const payload = transitionFieldsToRow(data);

  if (!noteId) {
    const { data: inserted, error } = await supabase
      .from("transition_notes")
      .insert({
        student_id: studentId,
        author_profile_id: userId,
        status: "draft",
        ...payload,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      return { ok: false, message: error?.message ?? "Could not save draft." };
    }
    await recordAuditEvent({
      action: "transition_note_drafted",
      actorUserId: userId,
      metadata: { studentId, noteId: inserted.id },
    });
    revalidateStudentTransitionPaths(studentId);
    return { ok: true, noteId: inserted.id };
  }

  if (!isStudentId(noteId)) {
    return { ok: false, message: "Invalid note id." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("transition_notes")
    .select("id, student_id, author_profile_id, status")
    .eq("id", noteId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Note not found." };
  }

  const row = existing as TransitionNoteRow;
  if (row.student_id !== studentId) {
    return { ok: false, message: "This note belongs to a different student." };
  }
  if (row.author_profile_id !== userId) {
    return { ok: false, message: "You can only edit your own notes." };
  }
  if (row.status !== "draft" && row.status !== "reopened") {
    return { ok: false, message: "This note can no longer be edited." };
  }

  const { error: upError } = await supabase
    .from("transition_notes")
    .update({
      ...payload,
      status: row.status,
    })
    .eq("id", noteId);

  if (upError) {
    return { ok: false, message: upError.message };
  }
  await recordAuditEvent({
    action: "transition_note_drafted",
    actorUserId: userId,
    metadata: { studentId, noteId },
  });
  revalidateStudentTransitionPaths(studentId);
  return { ok: true, noteId };
}

/** Submits a finalized transition note (locks teacher edits until reopened). */
export async function submitTransitionNote(
  studentId: string,
  noteId: string | undefined,
  data: TransitionNoteFields,
): Promise<TransitionNoteActionResult> {
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student id." };
  }
  const gate = await requireTeacherForStudent(studentId);
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;
  const payload = transitionFieldsToRow(data);

  let id = noteId;
  if (!id) {
    const { data: inserted, error } = await supabase
      .from("transition_notes")
      .insert({
        student_id: studentId,
        author_profile_id: userId,
        status: "draft",
        ...payload,
      })
      .select("id")
      .single();
    if (error || !inserted?.id) {
      return { ok: false, message: error?.message ?? "Could not create note." };
    }
    id = inserted.id;
  } else if (!isStudentId(id)) {
    return { ok: false, message: "Invalid note id." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("transition_notes")
    .select("id, student_id, author_profile_id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Note not found." };
  }
  const row = existing as TransitionNoteRow;
  if (row.student_id !== studentId) {
    return { ok: false, message: "This note belongs to a different student." };
  }
  if (row.author_profile_id !== userId) {
    return { ok: false, message: "You can only submit your own notes." };
  }
  if (row.status !== "draft" && row.status !== "reopened") {
    return { ok: false, message: "Only draft or reopened notes can be submitted." };
  }

  const { error: upError } = await supabase
    .from("transition_notes")
    .update({
      ...payload,
      status: "submitted",
      reviewed_at: null,
      archived_at: null,
    })
    .eq("id", id);

  if (upError) {
    return { ok: false, message: upError.message };
  }
  await recordAuditEvent({
    action: "transition_note_submitted",
    actorUserId: userId,
    metadata: { studentId, noteId: id },
  });
  revalidateStudentTransitionPaths(studentId);
  return { ok: true, noteId: id };
}

export type LoadedTransitionNoteForForm =
  | {
      ok: true;
      noteId?: string;
      studentId: string;
      status: NoteStatus;
      fields: TransitionNoteFields;
      editable: boolean;
    }
  | { ok: false; message: string };

/** Server-only load for the compose page (teacher access via RLS). */
export async function loadTransitionNoteForForm(args: {
  studentId: string;
  noteId?: string;
}): Promise<LoadedTransitionNoteForForm> {
  const { studentId, noteId } = args;
  if (!isStudentId(studentId)) {
    return { ok: false, message: "Invalid student id." };
  }
  const gate = await requireTeacherForStudent(studentId);
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  const { supabase, userId } = gate;

  if (!noteId) {
    return {
      ok: true,
      studentId,
      status: "draft",
      fields: emptyTransitionNote(),
      editable: true,
    };
  }

  if (!isStudentId(noteId)) {
    return { ok: false, message: "Invalid note id." };
  }

  const { data: row, error } = await supabase
    .from("transition_notes")
    .select(
      "id, student_id, author_profile_id, status, academic_strengths, academic_needs, reading_notes, writing_notes, math_notes, english_language_notes, learning_habits, social_emotional_notes, successful_strategies, recommended_next_steps",
    )
    .eq("id", noteId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: error?.message ?? "Note not found." };
  }
  const r = row as TransitionNoteRow & Record<string, string>;
  if (r.student_id !== studentId) {
    return { ok: false, message: "Note does not match this student." };
  }
  if (r.author_profile_id !== userId) {
    return { ok: false, message: "You can only open your own transition notes here." };
  }

  const status = r.status as NoteStatus;
  const editable = status === "draft" || status === "reopened";

  return {
    ok: true,
    noteId: r.id,
    studentId,
    status,
    fields: rowToTransitionFields({
      academic_strengths: r.academic_strengths,
      academic_needs: r.academic_needs,
      reading_notes: r.reading_notes,
      writing_notes: r.writing_notes,
      math_notes: r.math_notes,
      english_language_notes: r.english_language_notes,
      learning_habits: r.learning_habits,
      social_emotional_notes: r.social_emotional_notes,
      successful_strategies: r.successful_strategies,
      recommended_next_steps: r.recommended_next_steps,
    }),
    editable,
  };
}

export type SimpleActionResult = { ok: true } | { ok: false; message: string };

export async function reviewTransitionNoteAction(args: {
  studentId: string;
  noteId: string;
}): Promise<SimpleActionResult> {
  const { studentId, noteId } = args;
  if (!isStudentId(studentId) || !isStudentId(noteId)) {
    return { ok: false, message: "Invalid id." };
  }
  const gate = await requireModerator();
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;

  const { data: existing, error: loadError } = await supabase
    .from("transition_notes")
    .select("id, student_id, status")
    .eq("id", noteId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Note not found." };
  }
  const row = existing as { id: string; student_id: string; status: NoteStatus };
  if (row.student_id !== studentId) {
    return { ok: false, message: "Student mismatch." };
  }
  if (row.status !== "submitted") {
    return { ok: false, message: "Only submitted notes can be marked reviewed." };
  }

  const { error } = await supabase
    .from("transition_notes")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", noteId);

  if (error) return { ok: false, message: error.message };
  await recordAuditEvent({
    action: "transition_note_reviewed",
    actorUserId: userId,
    metadata: { studentId, noteId },
  });
  revalidateStudentTransitionPaths(studentId);
  return { ok: true };
}

export async function reopenTransitionNoteAction(args: {
  studentId: string;
  noteId: string;
}): Promise<SimpleActionResult> {
  const { studentId, noteId } = args;
  if (!isStudentId(studentId) || !isStudentId(noteId)) {
    return { ok: false, message: "Invalid id." };
  }
  const gate = await requireModerator();
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;

  const { data: existing, error: loadError } = await supabase
    .from("transition_notes")
    .select("id, student_id, status")
    .eq("id", noteId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Note not found." };
  }
  const row = existing as { id: string; student_id: string; status: NoteStatus };
  if (row.student_id !== studentId) {
    return { ok: false, message: "Student mismatch." };
  }
  if (row.status === "draft" || row.status === "reopened") {
    return { ok: false, message: "This note is already open for editing." };
  }

  const { error } = await supabase
    .from("transition_notes")
    .update({
      status: "reopened",
      reviewed_at: null,
      archived_at: null,
    })
    .eq("id", noteId);

  if (error) return { ok: false, message: error.message };
  await recordAuditEvent({
    action: "transition_note_reopened",
    actorUserId: userId,
    metadata: { studentId, noteId },
  });
  revalidateStudentTransitionPaths(studentId);
  return { ok: true };
}

export async function archiveTransitionNoteAction(args: {
  studentId: string;
  noteId: string;
}): Promise<SimpleActionResult> {
  const { studentId, noteId } = args;
  if (!isStudentId(studentId) || !isStudentId(noteId)) {
    return { ok: false, message: "Invalid id." };
  }
  const gate = await requireModerator();
  if (!gate.ok) return gate;
  const { supabase, userId } = gate;

  const { data: existing, error: loadError } = await supabase
    .from("transition_notes")
    .select("id, student_id, status")
    .eq("id", noteId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Note not found." };
  }
  const row = existing as { id: string; student_id: string; status: NoteStatus };
  if (row.student_id !== studentId) {
    return { ok: false, message: "Student mismatch." };
  }
  if (row.status === "archived") {
    return { ok: true };
  }

  const { error } = await supabase
    .from("transition_notes")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
    })
    .eq("id", noteId);

  if (error) return { ok: false, message: error.message };
  await recordAuditEvent({
    action: "transition_note_archived",
    actorUserId: userId,
    metadata: { studentId, noteId },
  });
  revalidateStudentTransitionPaths(studentId);
  return { ok: true };
}
