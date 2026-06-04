import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/config/roles";
import type { Database } from "@/types/database.types";

const REPORT_CARD_STAFF_ROLES = [
  "admin",
  "teacher",
  "registrar",
  "principal",
  "vice_principal",
] as const satisfies readonly Role[];

export type ReportCardStaffRole = (typeof REPORT_CARD_STAFF_ROLES)[number];

export type ReportCardStaff = {
  userId: string;
  role: ReportCardStaffRole;
};

function isReportCardStaffRole(role: string): role is ReportCardStaffRole {
  return (REPORT_CARD_STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * Returns the signed-in user when their profile role may upload or manage
 * report cards (aligned with `report_card_files` RLS).
 */
export async function getReportCardStaff(
  supabase: SupabaseClient<Database>,
): Promise<ReportCardStaff | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  if (isReportCardStaffRole(profile.role)) {
    return { userId: user.id, role: profile.role };
  }

  return null;
}

export async function assertTeacherCanAccessStudent(
  supabase: SupabaseClient<Database>,
  studentId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("teacher_can_access_student", {
    p_student_id: studentId,
  });
  if (error) {
    return false;
  }
  return data === true;
}
