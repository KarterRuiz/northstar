import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatStaffMemberAssignmentLabel,
  isClassAssignableStaffRole,
  isClassAssignableStaffStatus,
  CLASS_ASSIGNABLE_STAFF_ROLES,
  CLASS_ASSIGNABLE_STAFF_STATUSES,
} from "@/lib/staff/class-assignable-staff";
import type { Database } from "@/types/database.types";

type ServerClient = SupabaseClient<Database>;

export type EligibleClassStaffOption = {
  /** staff_members.id — stable identity for assignment. */
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  profile_id: string | null;
  label: string;
};

export type ClassStaffAssignmentRole = "homeroom" | "co_teacher" | "subject" | "assistant";

export type ClassStaffAssignmentInput = {
  staffMemberId: string;
  role: ClassStaffAssignmentRole;
};

/**
 * One efficient query for class staffing dropdowns (homeroom + additional).
 * Active/non-archived instructional & leadership roles; profile optional.
 */
export async function loadEligibleClassStaffOptions(
  supabase: ServerClient,
): Promise<{ ok: true; teachers: EligibleClassStaffOption[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, role, full_name, email, profile_id, status, archived_at, first_name, last_name")
    .in("role", [...CLASS_ASSIGNABLE_STAFF_ROLES])
    .in("status", [...CLASS_ASSIGNABLE_STAFF_STATUSES])
    .is("archived_at", null)
    .order("full_name", { ascending: true, nullsFirst: false })
    .order("id");

  if (error) {
    return { ok: false, message: error.message };
  }

  const teachers: EligibleClassStaffOption[] = [];
  for (const row of data ?? []) {
    if (!isClassAssignableStaffRole(row.role)) continue;
    if (!isClassAssignableStaffStatus(row.status)) continue;
    if (row.archived_at) continue;
    teachers.push({
      id: row.id,
      role: row.role,
      full_name: row.full_name ?? null,
      email: row.email ?? null,
      profile_id: row.profile_id ?? null,
      label: formatStaffMemberAssignmentLabel({
        full_name: row.full_name,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        role: row.role,
      }),
    });
  }

  return { ok: true, teachers };
}

/**
 * Mirrors staff_member_classes → class_teachers for an activated profile.
 * Idempotent; preserves role. Does not create fake profiles.
 */
export async function mirrorStaffMemberClassesToClassTeachers(
  supabase: ServerClient,
  staffMemberId: string,
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("staff_member_classes")
    .select("class_id, role")
    .eq("staff_member_id", staffMemberId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const { error: delErr } = await supabase
    .from("class_teachers")
    .delete()
    .eq("teacher_profile_id", profileId);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  if (!rows?.length) {
    return { ok: true };
  }

  const { error: insErr } = await supabase.from("class_teachers").insert(
    rows.map((r) => ({
      class_id: r.class_id,
      teacher_profile_id: profileId,
      role: (r.role as ClassStaffAssignmentRole) || "co_teacher",
    })),
  );
  if (insErr) {
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}

/**
 * Replace all staffing for one class in staff_member_classes (canonical),
 * then mirror live class_teachers for any assignees who already have profile_id.
 */
export async function replaceClassStaffAssignments(
  supabase: ServerClient,
  classId: string,
  assignments: ClassStaffAssignmentInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const seen = new Set<string>();
  const normalized: ClassStaffAssignmentInput[] = [];
  let homeroomCount = 0;

  for (const row of assignments) {
    if (seen.has(row.staffMemberId)) {
      return { ok: false, error: "Each staff member can only appear once on a class." };
    }
    seen.add(row.staffMemberId);
    if (row.role === "homeroom") homeroomCount += 1;
    normalized.push(row);
  }
  if (homeroomCount > 1) {
    return { ok: false, error: "A class can only have one homeroom teacher." };
  }

  const staffIds = normalized.map((r) => r.staffMemberId);
  const profileByStaff = new Map<string, string | null>();
  if (staffIds.length > 0) {
    const { data: members, error: membersErr } = await supabase
      .from("staff_members")
      .select("id, role, status, archived_at, profile_id")
      .in("id", staffIds);
    if (membersErr) {
      return { ok: false, error: membersErr.message };
    }
    const byId = new Map((members ?? []).map((m) => [m.id, m]));
    for (const id of staffIds) {
      const data = byId.get(id);
      if (!data) {
        return { ok: false, error: "Choose a staff member from the Teachers & Staff directory." };
      }
      if (data.archived_at || data.status === "archived" || data.status === "disabled") {
        return {
          ok: false,
          error: "Archived or deactivated staff cannot be assigned to classes.",
        };
      }
      if (!isClassAssignableStaffRole(data.role)) {
        return {
          ok: false,
          error: "Only teachers and instructional leadership can be assigned to classes.",
        };
      }
      if (!isClassAssignableStaffStatus(data.status)) {
        return {
          ok: false,
          error: "Only active staff directory members can be assigned to classes.",
        };
      }
      profileByStaff.set(id, data.profile_id ?? null);
    }
  }

  // Collect existing profile mirrors for this class so we can clear removed assignments.
  const { data: existingRows, error: existingErr } = await supabase
    .from("staff_member_classes")
    .select("staff_member_id")
    .eq("class_id", classId);
  if (existingErr) {
    return { ok: false, error: existingErr.message };
  }

  const previousStaffIds = (existingRows ?? []).map((r) => r.staff_member_id);
  const previousProfiles: string[] = [];
  if (previousStaffIds.length > 0) {
    const { data: prevMembers, error: prevErr } = await supabase
      .from("staff_members")
      .select("id, profile_id")
      .in("id", previousStaffIds);
    if (prevErr) {
      return { ok: false, error: prevErr.message };
    }
    for (const m of prevMembers ?? []) {
      if (m.profile_id) previousProfiles.push(m.profile_id);
    }
  }

  const { error: delSmcErr } = await supabase
    .from("staff_member_classes")
    .delete()
    .eq("class_id", classId);
  if (delSmcErr) {
    return { ok: false, error: delSmcErr.message };
  }

  if (normalized.length > 0) {
    const { error: insSmcErr } = await supabase.from("staff_member_classes").insert(
      normalized.map((r) => ({
        staff_member_id: r.staffMemberId,
        class_id: classId,
        role: r.role,
      })),
    );
    if (insSmcErr) {
      return { ok: false, error: insSmcErr.message };
    }
  }

  // Clear prior live mirrors for this class (activated staff only).
  if (previousProfiles.length > 0) {
    const { error: delCtErr } = await supabase
      .from("class_teachers")
      .delete()
      .eq("class_id", classId)
      .in("teacher_profile_id", previousProfiles);
    if (delCtErr) {
      return { ok: false, error: delCtErr.message };
    }
  }

  // Also clear any orphan class_teachers on this class that are not in the new set
  // (legacy profile-only rows). Prefer not to delete unrelated leadership mirrors —
  // only delete when we have a matching staff_members.profile_id outside the new set.
  const newProfileIds = [...profileByStaff.values()].filter((id): id is string => Boolean(id));
  const { data: leftoverCt, error: leftoverErr } = await supabase
    .from("class_teachers")
    .select("id, teacher_profile_id")
    .eq("class_id", classId);
  if (leftoverErr) {
    return { ok: false, error: leftoverErr.message };
  }
  const keepProfiles = new Set(newProfileIds);
  const orphanIds = (leftoverCt ?? [])
    .filter((r) => !keepProfiles.has(r.teacher_profile_id))
    .map((r) => r.id);
  if (orphanIds.length > 0) {
    const { error: orphanDelErr } = await supabase
      .from("class_teachers")
      .delete()
      .in("id", orphanIds);
    if (orphanDelErr) {
      return { ok: false, error: orphanDelErr.message };
    }
  }

  if (newProfileIds.length > 0) {
    const { error: insCtErr } = await supabase.from("class_teachers").insert(
      normalized
        .filter((r) => profileByStaff.get(r.staffMemberId))
        .map((r) => ({
          class_id: classId,
          teacher_profile_id: profileByStaff.get(r.staffMemberId)!,
          role: r.role,
        })),
    );
    if (insCtErr) {
      return { ok: false, error: insCtErr.message };
    }
  }

  return { ok: true };
}

/**
 * Upsert a single staff→class assignment (used by staff directory class pickers).
 * Preserves an existing role when the class is already assigned.
 */
export async function upsertStaffMemberClassAssignment(
  supabase: ServerClient,
  staffMemberId: string,
  classId: string,
  role: ClassStaffAssignmentRole = "co_teacher",
  profileId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await supabase
    .from("staff_member_classes")
    .select("id, role")
    .eq("staff_member_id", staffMemberId)
    .eq("class_id", classId)
    .maybeSingle();

  const nextRole = (existing?.role as ClassStaffAssignmentRole | undefined) ?? role;

  if (existing?.id) {
    if (existing.role !== nextRole) {
      const { error } = await supabase
        .from("staff_member_classes")
        .update({ role: nextRole })
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("staff_member_classes").insert({
      staff_member_id: staffMemberId,
      class_id: classId,
      role: nextRole,
    });
    if (error) return { ok: false, error: error.message };
  }

  if (profileId) {
    const { data: ctExisting } = await supabase
      .from("class_teachers")
      .select("id, role")
      .eq("teacher_profile_id", profileId)
      .eq("class_id", classId)
      .maybeSingle();
    if (ctExisting?.id) {
      if (ctExisting.role !== nextRole) {
        const { error } = await supabase
          .from("class_teachers")
          .update({ role: nextRole })
          .eq("id", ctExisting.id);
        if (error) return { ok: false, error: error.message };
      }
    } else {
      const { error } = await supabase.from("class_teachers").insert({
        class_id: classId,
        teacher_profile_id: profileId,
        role: nextRole,
      });
      if (error) return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}
