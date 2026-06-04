import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isLeadershipAuditRole, type Role } from "@/config/roles";
import { getProfileRole, getUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";
import { isStudentId, isUuid } from "@/lib/students/uuid";

export type InterventionGate =
  | {
      ok: true;
      userId: string;
      role: Role;
      supabase: SupabaseClient<Database>;
    }
  | { ok: false; message: string };

export async function requireCanCreateIntervention(args: {
  studentId: string;
  classId: string;
}): Promise<InterventionGate> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  if (!isStudentId(args.studentId)) {
    return { ok: false, message: "Invalid student id." };
  }
  if (!isUuid(args.classId)) {
    return { ok: false, message: "Invalid class id." };
  }

  const user = await getUser();
  if (!user) return { ok: false, message: "You must be signed in." };

  const role = await getProfileRole(user.id);
  if (!role) return { ok: false, message: "Profile not found." };

  const supabase = await createServerSupabaseClient();

  if (role === "teacher") {
    const { data, error } = await supabase.rpc("teacher_can_access_student", {
      p_student_id: args.studentId,
    });
    if (error) return { ok: false, message: error.message };
    if (data !== true) {
      return { ok: false, message: "You cannot access this student." };
    }
    const { data: assigned, error: classError } = await supabase.rpc(
      "teacher_is_assigned_to_class",
      { p_class_id: args.classId },
    );
    if (classError) return { ok: false, message: classError.message };
    if (assigned !== true) {
      return { ok: false, message: "You are not assigned to this class." };
    }
    return { ok: true, userId: user.id, role, supabase };
  }

  if (isLeadershipAuditRole(role)) {
    return { ok: true, userId: user.id, role, supabase };
  }

  return { ok: false, message: "You cannot create interventions for this student." };
}
