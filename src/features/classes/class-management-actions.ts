"use server";

import { revalidatePath } from "next/cache";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/logger";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  CLASS_TEACHER_EXTRA_ROLES,
  CLASS_TEACHER_ROLE_HOMEROOM,
  type ClassTeacherExtraRole,
} from "./constants";
import { CLASS_HAS_RECORDS_MESSAGE } from "./constants";
import { checkClassDeletable } from "./class-lifecycle";

export type ClassManagementMutationState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function trimStr(value: unknown, max: number): string {
  const s = String(value ?? "").trim();
  if (s.length > max) return s.slice(0, max);
  return s;
}

async function requireStructureManager(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string; role: Role }
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
  if (!role || !canManageSchoolStructure(role)) {
    return { ok: false, error: "You do not have permission to manage school structure." };
  }

  return { ok: true, supabase, userId: userData.user.id, role };
}

function revalidateClasses(role: Role) {
  revalidatePath(`/dashboard/${role}/classes`);
}

async function assertTeacherProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  teacherProfileId: string,
): Promise<ClassManagementMutationState | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", teacherProfileId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.role !== "teacher") {
    return { ok: false, error: "Homeroom and class teachers must be users with the teacher role." };
  }
  return null;
}

export async function createSchoolYearAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const label = trimStr(formData.get("label"), 200);
  const startsOn = trimStr(formData.get("startsOn"), 32);
  const endsOn = trimStr(formData.get("endsOn"), 32);

  if (!label) {
    return { ok: false, error: "School year label is required." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { ok: false, error: "Start and end dates must use YYYY-MM-DD format." };
  }
  if (startsOn > endsOn) {
    return { ok: false, error: "Start date must be on or before end date." };
  }

  const { error } = await ctx.supabase.from("school_years").insert({
    label,
    starts_on: startsOn,
    ends_on: endsOn,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateClasses(ctx.role);
  return { ok: true, message: `School year “${label}” was created.` };
}

export async function createGradeLevelAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const name = trimStr(formData.get("name"), 200);
  const sortRaw = String(formData.get("sortOrder") ?? "").trim();
  const codeRaw = trimStr(formData.get("code"), 40);

  if (!name) {
    return { ok: false, error: "Grade level name is required." };
  }

  const sortOrder = Number.parseInt(sortRaw, 10);
  if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    return { ok: false, error: "Sort order must be an integer from 0 to 999." };
  }

  const code = codeRaw.length > 0 ? codeRaw : null;

  const { error } = await ctx.supabase.from("grade_levels").insert({
    name,
    sort_order: sortOrder,
    code,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateClasses(ctx.role);
  return { ok: true, message: `Grade level “${name}” was created.` };
}

export async function createClassAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const schoolYearId = trimStr(formData.get("schoolYearId"), 64);
  const gradeLevelId = trimStr(formData.get("gradeLevelId"), 64);
  const name = trimStr(formData.get("name"), 200);
  const section = trimStr(formData.get("section"), 80);

  if (!isUuid(schoolYearId) || !isUuid(gradeLevelId)) {
    return { ok: false, error: "Choose a valid school year and grade level." };
  }
  if (!name) {
    return { ok: false, error: "Class name is required." };
  }

  const { data: created, error } = await ctx.supabase
    .from("classes")
    .insert({
      school_year_id: schoolYearId,
      grade_level_id: gradeLevelId,
      name,
      section: section.length > 0 ? section : null,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!created?.id) {
    return { ok: false, error: "Class was not created (no id returned)." };
  }

  await recordAuditEvent({
    action: "class_created",
    actorUserId: ctx.userId,
    metadata: {
      classId: created.id,
      schoolYearId,
      gradeLevelId,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class was created." };
}

export async function assignHomeroomTeacherAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const classId = trimStr(formData.get("classId"), 64);
  const teacherProfileId = trimStr(formData.get("teacherProfileId"), 64);

  if (!isUuid(classId) || !isUuid(teacherProfileId)) {
    return { ok: false, error: "Choose a class and a teacher." };
  }

  const teacherErr = await assertTeacherProfile(ctx.supabase, teacherProfileId);
  if (teacherErr) return teacherErr;

  const { error: delErr } = await ctx.supabase
    .from("class_teachers")
    .delete()
    .eq("class_id", classId)
    .eq("role", CLASS_TEACHER_ROLE_HOMEROOM);

  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  const { data: existing } = await ctx.supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("teacher_profile_id", teacherProfileId)
    .maybeSingle();

  if (existing?.id) {
    const { error: upErr } = await ctx.supabase
      .from("class_teachers")
      .update({ role: CLASS_TEACHER_ROLE_HOMEROOM })
      .eq("id", existing.id);
    if (upErr) {
      return { ok: false, error: upErr.message };
    }
  } else {
    const { error: insErr } = await ctx.supabase.from("class_teachers").insert({
      class_id: classId,
      teacher_profile_id: teacherProfileId,
      role: CLASS_TEACHER_ROLE_HOMEROOM,
    });
    if (insErr) {
      return { ok: false, error: insErr.message };
    }
  }

  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId: ctx.userId,
    metadata: {
      classId,
      teacherProfileId,
      assignmentRole: CLASS_TEACHER_ROLE_HOMEROOM,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Homeroom teacher was assigned." };
}

export async function assignAdditionalTeacherAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const classId = trimStr(formData.get("classId"), 64);
  const teacherProfileId = trimStr(formData.get("teacherProfileId"), 64);
  const roleRaw = trimStr(formData.get("assignmentRole"), 64) as ClassTeacherExtraRole;

  if (!isUuid(classId) || !isUuid(teacherProfileId)) {
    return { ok: false, error: "Choose a class and a teacher." };
  }

  if (!CLASS_TEACHER_EXTRA_ROLES.includes(roleRaw)) {
    return { ok: false, error: "Pick a valid assignment role." };
  }

  const teacherErr = await assertTeacherProfile(ctx.supabase, teacherProfileId);
  if (teacherErr) return teacherErr;

  const { error } = await ctx.supabase.from("class_teachers").insert({
    class_id: classId,
    teacher_profile_id: teacherProfileId,
    role: roleRaw,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId: ctx.userId,
    metadata: {
      classId,
      teacherProfileId,
      assignmentRole: roleRaw,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Teacher was added to the class." };
}

async function loadClassForLifecycle(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  classId: string,
): Promise<
  | { ok: true; id: string; name: string; school_year_id: string; is_active: boolean }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, school_year_id, is_active")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.id) {
    return { ok: false, error: "Class was not found." };
  }
  return { ok: true, ...data };
}

export async function archiveClassAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const classId = trimStr(formData.get("classId"), 64);
  if (!isUuid(classId)) {
    return { ok: false, error: "Invalid class id." };
  }

  const klass = await loadClassForLifecycle(ctx.supabase, classId);
  if (!klass.ok) return klass;

  if (klass.is_active === false) {
    return { ok: false, error: "This class is already archived." };
  }

  const { error } = await ctx.supabase
    .from("classes")
    .update({ is_active: false })
    .eq("id", classId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAuditEvent({
    action: "class_archived",
    actorUserId: ctx.userId,
    metadata: {
      classId,
      schoolYearId: klass.school_year_id,
      className: klass.name,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class was archived." };
}

export async function restoreClassAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const classId = trimStr(formData.get("classId"), 64);
  if (!isUuid(classId)) {
    return { ok: false, error: "Invalid class id." };
  }

  const klass = await loadClassForLifecycle(ctx.supabase, classId);
  if (!klass.ok) return klass;

  if (klass.is_active !== false) {
    return { ok: false, error: "This class is already active." };
  }

  const { error } = await ctx.supabase
    .from("classes")
    .update({ is_active: true })
    .eq("id", classId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordAuditEvent({
    action: "class_restored",
    actorUserId: ctx.userId,
    metadata: {
      classId,
      schoolYearId: klass.school_year_id,
      className: klass.name,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class was restored." };
}

export async function deleteClassAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const classId = trimStr(formData.get("classId"), 64);
  if (!isUuid(classId)) {
    return { ok: false, error: "Invalid class id." };
  }

  const klass = await loadClassForLifecycle(ctx.supabase, classId);
  if (!klass.ok) return klass;

  const deletable = await checkClassDeletable(ctx.supabase, classId);
  if (!deletable.ok) {
    return { ok: false, error: deletable.error };
  }
  if (!deletable.deletable) {
    return { ok: false, error: deletable.reason };
  }

  const { error } = await ctx.supabase.from("classes").delete().eq("id", classId);

  if (error) {
    if (error.message.includes("CLASS_HAS_ACADEMIC_RECORDS")) {
      return { ok: false, error: CLASS_HAS_RECORDS_MESSAGE };
    }
    return { ok: false, error: error.message };
  }

  await recordAuditEvent({
    action: "class_deleted",
    actorUserId: ctx.userId,
    metadata: {
      classId,
      schoolYearId: klass.school_year_id,
      className: klass.name,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class was permanently deleted." };
}
