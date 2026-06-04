/**
 * Auth session + profile reads for the App Router.
 * Password sign-in and sign-out live in `@/lib/auth/actions` (`signInWithPassword`, `signOut`).
 */
import { isRole, type Role } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Verified user from Supabase Auth (prefer this over `getSession` for authorization). */
export async function getUser() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * Loads `profiles.role` for the given user id.
 *
 * Returns `null` when the row is missing, `role` is null/empty, or the value is not one of
 * `admin` | `teacher` | `registrar` | `principal` | `vice_principal`. Callers should treat `null` as
 * "no valid dashboard role" (e.g. redirect to `/login?error=profile` after signing the user out).
 */
export async function getProfileRole(userId: string): Promise<Role | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.role || !isRole(data.role)) return null;
  return data.role;
}
