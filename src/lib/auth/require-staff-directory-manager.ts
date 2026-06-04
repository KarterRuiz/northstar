import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canManageStaffDirectory, isRole, type Role } from "@/config/roles";
import type { Database } from "@/types/database.types";

export type StaffDirectoryManagerActor = {
  userId: string;
  role: Role;
};

/**
 * Signed-in user with a role that may manage staff directory, invitations, and
 * staff profile fields (matches `public.is_staff_directory_manager()` in RLS).
 */
export async function getStaffDirectoryManagerActor(
  supabase: SupabaseClient<Database>,
): Promise<StaffDirectoryManagerActor | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.role || !isRole(profile.role)) return null;

  if (!canManageStaffDirectory(profile.role)) return null;

  return { userId: user.id, role: profile.role };
}
