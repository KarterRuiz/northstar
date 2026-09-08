"use server";

import { canManageClassEnrollment } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";
import { teacherStudentDisplayName } from "@/features/teacher/class-workspace/class-roster";

export type EnrollmentCandidate = {
  studentId: string;
  displayName: string;
  studentNumber: string | null;
};

export type SearchEnrollmentCandidatesResult =
  | { ok: true; students: EnrollmentCandidate[] }
  | { ok: false; message: string };

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Leadership search for students who can be enrolled into a class
 * (not already actively enrolled there).
 */
export async function searchStudentsForClassEnrollmentAction(args: {
  classId: string;
  query: string;
}): Promise<SearchEnrollmentCandidatesResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }
  const role = await getProfileRole(user.id);
  if (!role || !canManageClassEnrollment(role)) {
    return { ok: false, message: "You do not have permission to manage class enrollments." };
  }

  if (!isUuid(args.classId)) {
    return { ok: false, message: "Invalid class." };
  }

  const q = args.query.trim().replace(/,/g, " ").slice(0, 200);
  if (q.length < 2) {
    return { ok: true, students: [] };
  }

  const supabase = await createServerSupabaseClient();

  const { data: enrolledRows, error: enrolledErr } = await supabase
    .from("student_enrollments")
    .select("student_id")
    .eq("class_id", args.classId)
    .eq("status", "active");

  if (enrolledErr) {
    logServerError("roster.searchEnrollment.enrolled", enrolledErr.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const enrolled = new Set((enrolledRows ?? []).map((r) => r.student_id).filter(Boolean));
  const pattern = `%${escapeIlikePattern(q)}%`;

  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name, external_id")
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},preferred_name.ilike.${pattern},external_id.ilike.${pattern}`,
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(24);

  if (error) {
    logServerError("roster.searchEnrollment.students", error.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const students: EnrollmentCandidate[] = [];
  for (const row of data ?? []) {
    if (!row.id || enrolled.has(row.id)) continue;
    students.push({
      studentId: row.id,
      displayName: teacherStudentDisplayName({
        preferredName: row.preferred_name?.trim() || null,
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
      }),
      studentNumber: row.external_id?.trim() || null,
    });
  }

  return { ok: true, students: students.slice(0, 12) };
}
