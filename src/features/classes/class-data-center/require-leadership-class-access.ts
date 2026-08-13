import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { isUuid } from "@/lib/students/uuid";

export type LeadershipClassGate =
  | {
      ok: true;
      userId: string;
      role: Role;
      supabase: SupabaseClient<Database>;
    }
  | { ok: false; message: string };

/**
 * Leadership may open any class for observation. Does not grant teacher
 * gradebook mutation rights — those stay behind requireTeacherAssignedToClass.
 */
export async function requireLeadershipClassAccess(
  classId: string,
): Promise<LeadershipClassGate> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  if (!isUuid(classId)) {
    return { ok: false, message: "This class was not found." };
  }

  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const role = await getProfileRole(user.id);
  if (!role || !canManageSchoolStructure(role)) {
    return { ok: false, message: "Only school leadership can open the Class Data Center." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.id) {
    return { ok: false, message: "This class was not found." };
  }

  return { ok: true, userId: user.id, role, supabase };
}
