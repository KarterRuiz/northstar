import "server-only";

import type { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  ACTIVE_HOMEROOM_CONFLICT_MESSAGE,
  wouldCreateActiveHomeroomConflict,
} from "./current-homeroom";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type HomeroomConflictCheckResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Blocks creating/reactivating an active homeroom when the student already
 * has another status=active enrollment in the same school year (Option A).
 *
 * Does not apply when `nextStatus` is not `active`.
 * Transfer path withdraws source first (RPC) — call this only for plain inserts/reactivations.
 */
export async function assertNoActiveHomeroomConflict(
  supabase: Supabase,
  args: {
    studentId: string;
    schoolYearId: string;
    nextStatus: string;
    excludeEnrollmentId?: string | null;
  },
): Promise<HomeroomConflictCheckResult> {
  if (args.nextStatus !== "active") {
    return { ok: true };
  }

  const year = args.schoolYearId.trim();
  if (!year) {
    return { ok: false, message: "School year is required for enrollment." };
  }

  const { data, error } = await supabase
    .from("student_enrollments")
    .select("id, school_year_id, status")
    .eq("student_id", args.studentId)
    .eq("school_year_id", year)
    .eq("status", "active");

  if (error) {
    return { ok: false, message: error.message };
  }

  const conflict = wouldCreateActiveHomeroomConflict({
    schoolYearId: year,
    excludeEnrollmentId: args.excludeEnrollmentId,
    existingActiveInYear: (data ?? []).map((row) => ({
      id: row.id,
      schoolYearId: row.school_year_id,
      status: row.status,
    })),
  });

  if (conflict) {
    return { ok: false, message: ACTIVE_HOMEROOM_CONFLICT_MESSAGE };
  }

  return { ok: true };
}
