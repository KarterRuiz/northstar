import "server-only";

import { canManageParentRecordRequests, type Role } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireParentRecordsActor(): Promise<
  | {
      ok: true;
      userId: string;
      role: Role;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
    }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, error: "You must be signed in." };
  }

  const role = await getProfileRole(userData.user.id);
  if (!role || !canManageParentRecordRequests(role)) {
    return {
      ok: false,
      error: "You do not have permission to manage parent record requests.",
    };
  }

  return { ok: true, supabase, userId: userData.user.id, role };
}
