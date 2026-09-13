"use server";

import { revalidatePath } from "next/cache";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/logger";
import {
  logServerError,
  safeUserFacingMessage,
} from "@/lib/errors/safe-user-message";
import {
  CLASS_SCHOOL_YEAR_LOCKED_MESSAGE,
  classSchoolYearChangeBlocked,
} from "@/lib/school-years/school-year-integrity";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  CLASS_TEACHER_ROLE_HOMEROOM,
  CLASS_TEACHER_UI_EXTRA_ROLE_KEYS,
  type ClassTeacherUiExtraRole,
  uiExtraRoleToDbRole,
} from "./constants";
import { CLASS_HAS_RECORDS_MESSAGE } from "./constants";
import { checkClassDeletable } from "./class-lifecycle";
import {
  createClassWithTeachersBodySchema,
  updateClassDetailsBodySchema,
} from "./class-management-schemas";
import {
  replaceClassStaffAssignments,
  type ClassStaffAssignmentInput,
} from "./class-staff-assignments";

export type ClassManagementMutationState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

function failDb(scope: string, raw: string, fallback: string): { ok: false; error: string } {
  logServerError(`class-management.${scope}`, raw);
  return { ok: false, error: safeUserFacingMessage(raw, fallback) };
}

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

type InsertClassOk = { ok: true; classId: string };
type InsertClassErr = { ok: false; error: string };

async function insertClassRecord(
  ctx: { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string },
  params: {
    schoolYearId: string;
    gradeLevelId: string;
    name: string;
    section: string | null;
  },
): Promise<InsertClassOk | InsertClassErr> {
  const { data: grade, error: gradeErr } = await ctx.supabase
    .from("grade_levels")
    .select("id, is_archived")
    .eq("id", params.gradeLevelId)
    .maybeSingle();

  if (gradeErr) {
    return { ok: false, error: gradeErr.message };
  }
  if (!grade) {
    return { ok: false, error: "Choose a valid grade level." };
  }
  if (grade.is_archived) {
    return {
      ok: false,
      error: "That grade level is archived. Restore it in School settings before creating a class.",
    };
  }

  const { data: created, error } = await ctx.supabase
    .from("classes")
    .insert({
      school_year_id: params.schoolYearId,
      grade_level_id: params.gradeLevelId,
      name: params.name,
      section: params.section,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return failDb("createClass", error.message, "Could not create the class. Try again.");
  }
  if (!created?.id) {
    return { ok: false, error: "Class was not created (no id returned)." };
  }

  await recordAuditEvent({
    action: "class_created",
    actorUserId: ctx.userId,
    metadata: {
      classId: created.id,
      schoolYearId: params.schoolYearId,
      gradeLevelId: params.gradeLevelId,
    },
  });

  return { ok: true, classId: created.id };
}

async function rollbackNewClass(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  classId: string,
): Promise<void> {
  await supabase.from("staff_member_classes").delete().eq("class_id", classId);
  await supabase.from("class_teachers").delete().eq("class_id", classId);
  await supabase.from("classes").delete().eq("id", classId);
}

async function recordTeacherAssigned(
  actorUserId: string,
  classId: string,
  staffMemberId: string,
  assignmentRole: string,
) {
  await recordAuditEvent({
    action: "teacher_assigned",
    actorUserId,
    metadata: {
      classId,
      staffMemberId,
      teacherProfileId: staffMemberId,
      assignmentRole,
    },
  });
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

  const inserted = await insertClassRecord(ctx, {
    schoolYearId,
    gradeLevelId,
    name,
    section: section.length > 0 ? section : null,
  });
  if (!inserted.ok) return inserted;

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class was created." };
}

export async function createClassWithTeachersAction(
  input: unknown,
): Promise<ClassManagementMutationState> {
  const parsed = createClassWithTeachersBodySchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid request." };
  }

  const {
    schoolYearId,
    gradeLevelId,
    name,
    section,
    homeroomStaffMemberId,
    additionalTeachers,
  } = parsed.data;

  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const inserted = await insertClassRecord(ctx, {
    schoolYearId,
    gradeLevelId,
    name,
    section,
  });
  if (!inserted.ok) return inserted;

  const classId = inserted.classId;

  const assignments: ClassStaffAssignmentInput[] = [
    { staffMemberId: homeroomStaffMemberId, role: CLASS_TEACHER_ROLE_HOMEROOM },
    ...additionalTeachers.map((row) => ({
      staffMemberId: row.staffMemberId,
      role: uiExtraRoleToDbRole(row.uiRole),
    })),
  ];

  const staffing = await replaceClassStaffAssignments(ctx.supabase, classId, assignments);
  if (!staffing.ok) {
    await rollbackNewClass(ctx.supabase, classId);
    return { ok: false, error: staffing.error };
  }

  await recordTeacherAssigned(
    ctx.userId,
    classId,
    homeroomStaffMemberId,
    CLASS_TEACHER_ROLE_HOMEROOM,
  );

  for (const row of additionalTeachers) {
    await recordTeacherAssigned(
      ctx.userId,
      classId,
      row.staffMemberId,
      uiExtraRoleToDbRole(row.uiRole),
    );
  }

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class was created with teachers assigned." };
}

export async function updateClassDetailsAction(
  input: unknown,
): Promise<ClassManagementMutationState> {
  const parsed = updateClassDetailsBodySchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid request." };
  }

  const { classId, schoolYearId, gradeLevelId, name, section } = parsed.data;

  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const klass = await loadClassForLifecycle(ctx.supabase, classId);
  if (!klass.ok) return klass;

  if (klass.school_year_id !== schoolYearId) {
    const { count, error: enrCountErr } = await ctx.supabase
      .from("student_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId);
    if (enrCountErr) {
      logServerError("class-management.updateDetails.enrollments", enrCountErr.message);
      return {
        ok: false,
        error: safeUserFacingMessage(
          enrCountErr.message,
          "Could not validate class enrollments. Try again.",
        ),
      };
    }
    if (
      classSchoolYearChangeBlocked({
        previousSchoolYearId: klass.school_year_id,
        nextSchoolYearId: schoolYearId,
        enrollmentCount: count ?? 0,
      })
    ) {
      return { ok: false, error: CLASS_SCHOOL_YEAR_LOCKED_MESSAGE };
    }
  }

  const { data: year, error: yearErr } = await ctx.supabase
    .from("school_years")
    .select("id")
    .eq("id", schoolYearId)
    .is("archived_at", null)
    .maybeSingle();

  if (yearErr) {
    logServerError("class-management.updateDetails.year", yearErr.message);
    return {
      ok: false,
      error: safeUserFacingMessage(yearErr.message, "Could not validate school year. Try again."),
    };
  }
  if (!year) {
    return { ok: false, error: "Choose a valid school year." };
  }

  const { data: grade, error: gradeErr } = await ctx.supabase
    .from("grade_levels")
    .select("id, is_archived")
    .eq("id", gradeLevelId)
    .maybeSingle();

  if (gradeErr) {
    return { ok: false, error: gradeErr.message };
  }
  if (!grade) {
    return { ok: false, error: "Choose a valid grade level." };
  }
  if (grade.is_archived) {
    const { data: current } = await ctx.supabase
      .from("classes")
      .select("grade_level_id")
      .eq("id", classId)
      .maybeSingle();
    if (current?.grade_level_id !== gradeLevelId) {
      return {
        ok: false,
        error: "That grade level is archived. Restore it in School settings before assigning it.",
      };
    }
  }

  const { error } = await ctx.supabase
    .from("classes")
    .update({
      school_year_id: schoolYearId,
      grade_level_id: gradeLevelId,
      name,
      section,
    })
    .eq("id", classId);

  if (error) {
    if (
      error.message.includes("classes.school_year_id cannot change after enrollments") ||
      error.message.includes(CLASS_SCHOOL_YEAR_LOCKED_MESSAGE)
    ) {
      return { ok: false, error: CLASS_SCHOOL_YEAR_LOCKED_MESSAGE };
    }
    return failDb("updateDetails", error.message, "Could not update class details. Try again.");
  }

  await recordAuditEvent({
    action: "class_updated",
    actorUserId: ctx.userId,
    metadata: {
      classId,
      schoolYearId,
      gradeLevelId,
      className: name,
    },
  });

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class details were saved." };
}

type AdditionalTeacherPayload = { staffMemberId: string; uiRole: ClassTeacherUiExtraRole };

function parseAdditionalTeachersJson(raw: string): AdditionalTeacherPayload[] | null {
  const s = raw.trim();
  if (s.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(s) as unknown;
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const out: AdditionalTeacherPayload[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const staffMemberId = trimStr((item as { staffMemberId?: unknown }).staffMemberId, 64);
    const uiRoleRaw = trimStr((item as { uiRole?: unknown }).uiRole, 32);
    if (!isUuid(staffMemberId)) return null;
    if (!(CLASS_TEACHER_UI_EXTRA_ROLE_KEYS as readonly string[]).includes(uiRoleRaw)) {
      return null;
    }
    out.push({ staffMemberId, uiRole: uiRoleRaw as ClassTeacherUiExtraRole });
  }
  return out;
}

export async function saveClassTeachersAction(
  _prev: ClassManagementMutationState | undefined,
  formData: FormData,
): Promise<ClassManagementMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const classId = trimStr(formData.get("classId"), 64);
  const homeroomRaw = trimStr(formData.get("homeroomStaffMemberId"), 64);
  const additionalRaw = trimStr(formData.get("additionalTeachers"), 50_000);

  if (!isUuid(classId)) {
    return { ok: false, error: "Invalid class." };
  }

  const homeroomStaffMemberId =
    homeroomRaw.length === 0 || homeroomRaw === "__none__" ? null : homeroomRaw;
  if (homeroomStaffMemberId !== null && !isUuid(homeroomStaffMemberId)) {
    return { ok: false, error: "Pick a valid homeroom teacher or leave unassigned." };
  }

  const additionalTeachers = parseAdditionalTeachersJson(additionalRaw);
  if (additionalTeachers === null) {
    return { ok: false, error: "Additional teachers payload is invalid." };
  }
  if (additionalTeachers.length > 40) {
    return { ok: false, error: "Too many additional teacher rows." };
  }

  const extraIds = additionalTeachers.map((r) => r.staffMemberId);
  const uniqueExtra = new Set(extraIds);
  if (uniqueExtra.size !== extraIds.length) {
    return { ok: false, error: "Each teacher can only appear once in additional teachers." };
  }

  if (homeroomStaffMemberId && extraIds.some((id) => id === homeroomStaffMemberId)) {
    return {
      ok: false,
      error: "Remove the homeroom teacher from the additional teachers list.",
    };
  }

  const assignments: ClassStaffAssignmentInput[] = [];
  if (homeroomStaffMemberId) {
    assignments.push({
      staffMemberId: homeroomStaffMemberId,
      role: CLASS_TEACHER_ROLE_HOMEROOM,
    });
  }
  for (const row of additionalTeachers) {
    assignments.push({
      staffMemberId: row.staffMemberId,
      role: uiExtraRoleToDbRole(row.uiRole),
    });
  }

  const staffing = await replaceClassStaffAssignments(ctx.supabase, classId, assignments);
  if (!staffing.ok) {
    return { ok: false, error: staffing.error };
  }

  for (const row of additionalTeachers) {
    await recordTeacherAssigned(
      ctx.userId,
      classId,
      row.staffMemberId,
      uiExtraRoleToDbRole(row.uiRole),
    );
  }

  if (homeroomStaffMemberId) {
    await recordTeacherAssigned(
      ctx.userId,
      classId,
      homeroomStaffMemberId,
      CLASS_TEACHER_ROLE_HOMEROOM,
    );
  }

  revalidateClasses(ctx.role);
  return { ok: true, message: "Class teachers were saved." };
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
    return failDb("loadClass", error.message, "Could not load the class. Try again.");
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
    return failDb("archive", error.message, "Could not archive the class. Try again.");
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
    return failDb("restore", error.message, "Could not restore the class. Try again.");
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
    return failDb("delete", error.message, "Could not delete the class. Try again.");
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
