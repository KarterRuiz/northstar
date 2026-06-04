import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getProfileRole, getUser } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/types/database.types";
import { isUuid } from "@/lib/students/uuid";

export type TeacherClassGate =
  | {
      ok: true;
      userId: string;
      supabase: SupabaseClient<Database>;
    }
  | { ok: false; message: string };

export async function requireTeacherAssignedToClass(
  classId: string,
): Promise<TeacherClassGate> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }
  if (!isUuid(classId)) {
    return { ok: false, message: "Invalid class id." };
  }

  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const role = await getProfileRole(user.id);
  if (role !== "teacher") {
    return { ok: false, message: "Only teachers can manage class rosters." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("teacher_is_assigned_to_class", {
    p_class_id: classId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  if (data !== true) {
    return { ok: false, message: "You are not assigned to this class." };
  }

  return { ok: true, userId: user.id, supabase };
}

export async function requireTeacherCanAccessStudent(
  studentId: string,
): Promise<TeacherClassGate> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const user = await getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const role = await getProfileRole(user.id);
  if (role !== "teacher") {
    return { ok: false, message: "Only teachers can edit students on their rosters." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("teacher_can_access_student", {
    p_student_id: studentId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  if (data !== true) {
    return { ok: false, message: "You are not assigned to this student." };
  }

  return { ok: true, userId: user.id, supabase };
}
