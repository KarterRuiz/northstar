import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type AdminActor = {
  userId: string;
};

/**
 * Returns the signed-in user when their `profiles.role` is `admin`.
 * Use in server actions and admin-only routes (RLS still applies).
 */
export async function getAdminActor(
  supabase: SupabaseClient<Database>,
): Promise<AdminActor | null> {
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

  if (profileError || !profile?.role || profile.role !== "admin") {
    return null;
  }

  return { userId: user.id };
}
