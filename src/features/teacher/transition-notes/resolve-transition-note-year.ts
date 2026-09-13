import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { resolveTransitionNoteSchoolYearId } from "@/lib/school-years/school-year-integrity";
import type { Database } from "@/types/database.types";

/**
 * Resolves school_year_id for NEW transition notes only.
 * Prefer active enrollment matching current year → any active enrollment → current year.
 * Does not backfill historical null rows.
 */
export async function resolveSchoolYearIdForNewTransitionNote(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<{ ok: true; schoolYearId: string | null } | { ok: false; error: string }> {
  const [currentRes, enrollmentsRes] = await Promise.all([
    loadCurrentSchoolYear(supabase),
    supabase
      .from("student_enrollments")
      .select("school_year_id")
      .eq("student_id", studentId)
      .eq("status", "active"),
  ]);

  if (!currentRes.ok) {
    return { ok: false, error: currentRes.error };
  }
  if (enrollmentsRes.error) {
    return { ok: false, error: enrollmentsRes.error.message };
  }

  const schoolYearId = resolveTransitionNoteSchoolYearId({
    currentYearId: currentRes.year?.id ?? null,
    activeEnrollmentYearIds: (enrollmentsRes.data ?? []).map(
      (row) => row.school_year_id,
    ),
  });

  return { ok: true, schoolYearId };
}
