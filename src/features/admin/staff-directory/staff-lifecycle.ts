import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { STAFF_HAS_RECORDS_MESSAGE } from "./constants";

export { STAFF_DELETE_CONFIRM_HINT, STAFF_HAS_RECORDS_MESSAGE } from "./constants";

export type StaffDeletableCheck =
  | { ok: true; deletable: true }
  | { ok: true; deletable: false; reason: typeof STAFF_HAS_RECORDS_MESSAGE }
  | { ok: false; error: string };

type CountHead = { count: number | null; error: { message: string } | null };

async function hasAnyRows(result: CountHead): Promise<StaffDeletableCheck | null> {
  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  if ((result.count ?? 0) > 0) {
    return { ok: true, deletable: false, reason: STAFF_HAS_RECORDS_MESSAGE };
  }
  return null;
}

/**
 * Permanent delete is only safe when the profile has no meaningful school history.
 * Soft dependents (audit SET NULL, voided_by SET NULL) do not block deletion.
 */
export async function checkStaffDeletable(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<StaffDeletableCheck> {
  const checks = await Promise.all([
    supabase
      .from("class_teachers")
      .select("id", { count: "exact", head: true })
      .eq("teacher_profile_id", profileId),
    supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("recorded_by", profileId),
    supabase
      .from("behavior_records")
      .select("id", { count: "exact", head: true })
      .eq("recorded_by", profileId),
    supabase
      .from("report_card_comments")
      .select("id", { count: "exact", head: true })
      .eq("teacher_profile_id", profileId),
    supabase
      .from("academic_records")
      .select("id", { count: "exact", head: true })
      .eq("teacher_profile_id", profileId),
    supabase
      .from("gradebook_categories")
      .select("id", { count: "exact", head: true })
      .eq("teacher_profile_id", profileId),
    supabase
      .from("gradebook_assignments")
      .select("id", { count: "exact", head: true })
      .eq("teacher_profile_id", profileId),
    supabase
      .from("student_interventions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", profileId),
    supabase
      .from("transition_notes")
      .select("id", { count: "exact", head: true })
      .eq("author_profile_id", profileId),
    supabase
      .from("staff_invitations")
      .select("id", { count: "exact", head: true })
      .eq("invited_by", profileId),
    supabase
      .from("parent_record_requests")
      .select("id", { count: "exact", head: true })
      .or(
        `assigned_to_profile_id.eq.${profileId},submitted_by_profile_id.eq.${profileId}`,
      ),
  ]);

  for (const result of checks) {
    const blocked = await hasAnyRows(result);
    if (blocked) return blocked;
  }

  return { ok: true, deletable: true };
}

export async function fetchStaffDeletabilityMap(
  supabase: SupabaseClient<Database>,
  profileIds: string[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  await Promise.all(
    profileIds.map(async (id) => {
      const result = await checkStaffDeletable(supabase, id);
      map.set(id, result.ok && result.deletable);
    }),
  );
  return map;
}
