"use server";

import { revalidatePath } from "next/cache";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit/logger";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { logSchoolSettingsError } from "@/features/school-settings/safe-admin-error";

import {
  gradeLevelDbErrorMessage,
  inferCodeFromName,
  inferSortOrderFromName,
  normalizeGradeCode,
} from "./grade-level-helpers";

function failGradeDb(scope: string, message: string, fallback: string): {
  ok: false;
  error: string;
} {
  logSchoolSettingsError(scope, message);
  return { ok: false, error: gradeLevelDbErrorMessage(message, fallback) };
}

export type GradeLevelMutationState =
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
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      userId: string;
      role: Role;
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
  if (!role || !canManageSchoolStructure(role)) {
    return { ok: false, error: "You do not have permission to manage school structure." };
  }

  return { ok: true, supabase, userId: userData.user.id, role };
}

function revalidateStructure(role: Role) {
  revalidatePath(`/dashboard/${role}/classes`);
  revalidatePath(`/dashboard/${role}/school-settings`);
}

type GradeLevelFields = {
  name: string;
  sortOrder: number;
  code: string | null;
};

async function resolveGradeLevelFields(
  formData: FormData,
  options: { requireExplicitSort?: boolean } = {},
): Promise<{ ok: true; fields: GradeLevelFields } | { ok: false; error: string }> {
  const name = trimStr(formData.get("name"), 200);
  if (!name) {
    return { ok: false, error: "Grade level name is required." };
  }

  const sortRaw = String(formData.get("sortOrder") ?? "").trim();
  let sortOrder: number | null = null;

  if (sortRaw !== "") {
    const parsed = Number.parseInt(sortRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999) {
      return { ok: false, error: "Display order must be a whole number from 0 to 999." };
    }
    sortOrder = parsed;
  } else {
    sortOrder = inferSortOrderFromName(name);
  }

  if (sortOrder === null) {
    if (options.requireExplicitSort) {
      return {
        ok: false,
        error: "Enter a display order (for example, 5 for Grade 5).",
      };
    }
    return {
      ok: false,
      error:
        "Could not determine display order from the name. Enter a whole number (for example, 5).",
    };
  }

  const codeRaw = trimStr(formData.get("code"), 40);
  let code = normalizeGradeCode(codeRaw);
  if (!code) {
    code = normalizeGradeCode(inferCodeFromName(name));
  }

  return { ok: true, fields: { name, sortOrder, code } };
}

async function assertUniqueGradeLevelFields(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  fields: GradeLevelFields,
  excludeId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("grade_levels")
    .select("id, name, code");

  if (error) {
    return failGradeDb(
      "assertUniqueGradeLevelFields",
      error.message,
      "Grade levels could not be checked. Try again.",
    );
  }

  const others = (rows ?? []).filter((r) => r.id !== excludeId);
  const nameKey = fields.name.toLowerCase();
  if (others.some((r) => r.name.trim().toLowerCase() === nameKey)) {
    return {
      ok: false,
      error: "A grade level with this name already exists. Choose a different name.",
    };
  }

  // Display order (sort_order) may be shared across parallel programs.

  if (fields.code) {
    const codeKey = fields.code.toLowerCase();
    if (
      others.some(
        (r) => typeof r.code === "string" && r.code.trim().toLowerCase() === codeKey,
      )
    ) {
      return {
        ok: false,
        error: "A grade level with this code already exists. Choose a different code.",
      };
    }
  }

  return { ok: true };
}

async function countClassesForGrade(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  gradeLevelId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { count, error } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("grade_level_id", gradeLevelId);

  if (error) {
    return failGradeDb(
      "countClassesForGrade",
      error.message,
      "Grade level could not be updated. Try again.",
    );
  }

  return { ok: true, count: count ?? 0 };
}

export async function createGradeLevelAction(
  _prev: GradeLevelMutationState | undefined,
  formData: FormData,
): Promise<GradeLevelMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const resolved = await resolveGradeLevelFields(formData);
  if (!resolved.ok) return resolved;

  const fields = resolved.fields;
  const unique = await assertUniqueGradeLevelFields(ctx.supabase, fields);
  if (!unique.ok) return unique;

  const { error } = await ctx.supabase.from("grade_levels").insert({
    name: fields.name,
    sort_order: fields.sortOrder,
    code: fields.code,
    is_archived: false,
  });

  if (error) {
    return failGradeDb("gradeLevel.mutate", error.message, "Could not create grade level.");
  }

  await recordAuditEvent({
    action: "grade_level_created",
    actorUserId: ctx.userId,
    metadata: {
      name: fields.name,
      sortOrder: fields.sortOrder,
      code: fields.code,
    },
  });

  revalidateStructure(ctx.role);
  return { ok: true, message: `Grade level “${fields.name}” was created.` };
}

export async function updateGradeLevelAction(
  _prev: GradeLevelMutationState | undefined,
  formData: FormData,
): Promise<GradeLevelMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("gradeLevelId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid grade level." };
  }

  const resolved = await resolveGradeLevelFields(formData, { requireExplicitSort: true });
  if (!resolved.ok) return resolved;

  const unique = await assertUniqueGradeLevelFields(ctx.supabase, resolved.fields, id);
  if (!unique.ok) return unique;

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("grade_levels")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failGradeDb("gradeLevel.load", loadErr.message, "Grade level could not be updated. Try again.");
  }
  if (!existing) {
    return { ok: false, error: "Grade level was not found." };
  }

  const { error } = await ctx.supabase
    .from("grade_levels")
    .update({
      name: resolved.fields.name,
      sort_order: resolved.fields.sortOrder,
      code: resolved.fields.code,
    })
    .eq("id", id);

  if (error) {
    return failGradeDb("gradeLevel.mutate", error.message, "Could not update grade level.");
  }

  await recordAuditEvent({
    action: "grade_level_updated",
    actorUserId: ctx.userId,
    metadata: {
      gradeLevelId: id,
      name: resolved.fields.name,
      sortOrder: resolved.fields.sortOrder,
      code: resolved.fields.code,
    },
  });

  revalidateStructure(ctx.role);
  return { ok: true, message: `Grade level “${resolved.fields.name}” was updated.` };
}

export async function archiveGradeLevelAction(
  _prev: GradeLevelMutationState | undefined,
  formData: FormData,
): Promise<GradeLevelMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("gradeLevelId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid grade level." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("grade_levels")
    .select("id, name, is_archived")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failGradeDb("gradeLevel.load", loadErr.message, "Grade level could not be updated. Try again.");
  }
  if (!existing) {
    return { ok: false, error: "Grade level was not found." };
  }
  if (existing.is_archived) {
    return { ok: false, error: "This grade level is already archived." };
  }

  const { error } = await ctx.supabase
    .from("grade_levels")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) {
    return failGradeDb("gradeLevel.mutate", error.message, "Could not archive grade level.");
  }

  await recordAuditEvent({
    action: "grade_level_archived",
    actorUserId: ctx.userId,
    metadata: { gradeLevelId: id, name: existing.name },
  });

  revalidateStructure(ctx.role);
  return {
    ok: true,
    message: `${existing.name} was archived. It is hidden from new setup; historical school records stay linked.`,
  };
}

export async function restoreGradeLevelAction(
  _prev: GradeLevelMutationState | undefined,
  formData: FormData,
): Promise<GradeLevelMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("gradeLevelId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid grade level." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("grade_levels")
    .select("id, name, sort_order, code, is_archived")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failGradeDb("gradeLevel.load", loadErr.message, "Grade level could not be updated. Try again.");
  }
  if (!existing) {
    return { ok: false, error: "Grade level was not found." };
  }
  if (!existing.is_archived) {
    return { ok: false, error: "This grade level is already active." };
  }

  const unique = await assertUniqueGradeLevelFields(
    ctx.supabase,
    {
      name: existing.name,
      sortOrder: existing.sort_order,
      code: normalizeGradeCode(existing.code),
    },
    id,
  );
  if (!unique.ok) {
    return {
      ok: false,
      error: `${unique.error} Resolve the conflict (or rename this grade) before restoring.`,
    };
  }

  const { error } = await ctx.supabase
    .from("grade_levels")
    .update({ is_archived: false })
    .eq("id", id);

  if (error) {
    return failGradeDb("gradeLevel.mutate", error.message, "Could not restore grade level.");
  }

  await recordAuditEvent({
    action: "grade_level_restored",
    actorUserId: ctx.userId,
    metadata: { gradeLevelId: id, name: existing.name },
  });

  revalidateStructure(ctx.role);
  return { ok: true, message: `“${existing.name}” was restored and is available for new classes.` };
}

export async function deleteGradeLevelAction(
  _prev: GradeLevelMutationState | undefined,
  formData: FormData,
): Promise<GradeLevelMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("gradeLevelId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid grade level." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("grade_levels")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failGradeDb("gradeLevel.load", loadErr.message, "Grade level could not be updated. Try again.");
  }
  if (!existing) {
    return { ok: false, error: "Grade level was not found." };
  }

  const deps = await countClassesForGrade(ctx.supabase, id);
  if (!deps.ok) return deps;

  if (deps.count > 0) {
    return {
      ok: false,
      error: `${existing.name} cannot be deleted because school records are attached to it. Archive it instead.`,
    };
  }

  const { error } = await ctx.supabase.from("grade_levels").delete().eq("id", id);

  if (error) {
    return failGradeDb("gradeLevel.mutate", error.message, "Could not delete grade level.");
  }

  await recordAuditEvent({
    action: "grade_level_deleted",
    actorUserId: ctx.userId,
    metadata: { gradeLevelId: id, name: existing.name },
  });

  revalidateStructure(ctx.role);
  return { ok: true, message: `Grade level “${existing.name}” was permanently deleted.` };
}
