import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import {
  buildStudentDeleteSafety,
  type StudentDeleteSafety,
  type StudentHistoryDependencyKey,
} from "./student-delete-safety";

type Sb = SupabaseClient<Database>;

const IN_CHUNK = 120;

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(ids.slice(i, i + IN_CHUNK));
  return out;
}

async function markFromStudentIdColumn(
  supabase: Sb,
  table:
    | "attendance_records"
    | "behavior_records"
    | "gradebook_scores"
    | "academic_records"
    | "report_card_files"
    | "report_card_comments"
    | "transition_notes"
    | "student_interventions"
    | "parent_record_requests"
    | "follow_ups",
  studentIds: string[],
  key: StudentHistoryDependencyKey,
  presentByStudent: Map<string, Set<StudentHistoryDependencyKey>>,
): Promise<void> {
  for (const part of chunkIds(studentIds)) {
    const { data, error } = await supabase
      .from(table)
      .select("student_id")
      .in("student_id", part)
      .limit(part.length * 4);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.student_id) presentByStudent.get(row.student_id)?.add(key);
    }
  }
}

/**
 * Inspect dependent tables for one or many students.
 * Enrollment rows alone do not block hard delete (they cascade with the student).
 */
export async function assessStudentsDeleteSafety(
  supabase: Sb,
  studentIds: string[],
): Promise<Map<string, StudentDeleteSafety>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  const result = new Map<string, StudentDeleteSafety>();
  if (unique.length === 0) return result;

  const presentByStudent = new Map<string, Set<StudentHistoryDependencyKey>>();
  for (const id of unique) {
    presentByStudent.set(id, new Set());
  }

  await Promise.all([
    markFromStudentIdColumn(
      supabase,
      "attendance_records",
      unique,
      "attendance",
      presentByStudent,
    ),
    markFromStudentIdColumn(
      supabase,
      "behavior_records",
      unique,
      "behavior",
      presentByStudent,
    ),
    markFromStudentIdColumn(supabase, "gradebook_scores", unique, "grades", presentByStudent),
    markFromStudentIdColumn(
      supabase,
      "academic_records",
      unique,
      "academic",
      presentByStudent,
    ),
    markFromStudentIdColumn(
      supabase,
      "report_card_files",
      unique,
      "reportCards",
      presentByStudent,
    ),
    markFromStudentIdColumn(
      supabase,
      "report_card_comments",
      unique,
      "reportComments",
      presentByStudent,
    ),
    markFromStudentIdColumn(
      supabase,
      "transition_notes",
      unique,
      "transitionNotes",
      presentByStudent,
    ),
    markFromStudentIdColumn(
      supabase,
      "student_interventions",
      unique,
      "interventions",
      presentByStudent,
    ),
    markFromStudentIdColumn(
      supabase,
      "parent_record_requests",
      unique,
      "parentRequests",
      presentByStudent,
    ),
    markFromStudentIdColumn(supabase, "follow_ups", unique, "followUps", presentByStudent),
  ]);

  for (const part of chunkIds(unique)) {
    const { data, error } = await supabase
      .from("calendar_notes")
      .select("related_student_id")
      .in("related_student_id", part)
      .limit(part.length * 4);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.related_student_id) {
        presentByStudent.get(row.related_student_id)?.add("calendarNotes");
      }
    }
  }

  for (const id of unique) {
    result.set(id, buildStudentDeleteSafety(presentByStudent.get(id) ?? []));
  }

  return result;
}

export async function assessStudentDeleteSafety(
  supabase: Sb,
  studentId: string,
): Promise<StudentDeleteSafety> {
  const map = await assessStudentsDeleteSafety(supabase, [studentId]);
  return map.get(studentId) ?? buildStudentDeleteSafety([]);
}
