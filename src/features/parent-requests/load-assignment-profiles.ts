import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AssignmentProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

export async function loadProfilesForParentRequestAssignment(): Promise<
  | { ok: true; profiles: AssignmentProfileRow[] }
  | { ok: false; message: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .in("role", ["admin", "principal", "vice_principal", "registrar"])
    .order("full_name", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    profiles: (data ?? []) as AssignmentProfileRow[],
  };
}
