"use server";

import { revalidatePath } from "next/cache";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { pickPreferredSchoolYearId } from "@/lib/school-years/current-school-year";

import {
  logSchoolSettingsError,
  schoolYearDbErrorMessage,
} from "./safe-admin-error";
import {
  canonicalizeSchoolYearLabel,
  normalizeSchoolYearLabel,
} from "./school-year-label";

export type SchoolYearMutationState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_YEAR_ERROR = "School year could not be updated. Try again.";

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function trimStr(value: unknown, max: number): string {
  const s = String(value ?? "").trim();
  if (s.length > max) return s.slice(0, max);
  return s;
}

function failDb(scope: string, message: string): { ok: false; error: string } {
  logSchoolSettingsError(scope, message);
  return {
    ok: false,
    error: schoolYearDbErrorMessage(message, GENERIC_YEAR_ERROR),
  };
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
    logSchoolSettingsError("requireStructureManager", "Supabase is not configured");
    return { ok: false, error: "School year could not be updated. Try again." };
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

function revalidateSchoolStructure(role: Role) {
  revalidatePath(`/dashboard/${role}/school-settings`);
  revalidatePath(`/dashboard/${role}/classes`);
  revalidatePath(`/dashboard/${role}`);
  revalidatePath(`/dashboard/${role}/students`);
  revalidatePath(`/dashboard/${role}/students/import`);
  revalidatePath(`/dashboard/${role}/report-cards`);
}

function parseYearDates(
  startsOn: string,
  endsOn: string,
): { ok: true; startsOn: string; endsOn: string } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { ok: false, error: "Start and end dates must use YYYY-MM-DD format." };
  }
  if (startsOn > endsOn) {
    return { ok: false, error: "Start date must be on or before end date." };
  }
  return { ok: true, startsOn, endsOn };
}

async function assertLabelAvailable(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  label: string,
  excludeId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeSchoolYearLabel(label);
  if (!normalized) {
    return { ok: false, error: "School year label is required." };
  }

  const { data, error } = await supabase.from("school_years").select("id, label");
  if (error) {
    return failDb("assertLabelAvailable", error.message);
  }

  const clash = (data ?? []).find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return normalizeSchoolYearLabel(row.label) === normalized;
  });

  if (clash) {
    return {
      ok: false,
      error: `A school year labeled “${clash.label}” already exists. Labels must be unique (hyphen and dash characters are treated the same).`,
    };
  }

  return { ok: true };
}

/**
 * Clears Current flag on all years. Relies on school_years.is_current
 * (migration 20260807121000). Schema errors are returned — never swallowed.
 */
async function clearAllCurrentYears(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("school_years")
    .update({ is_current: false })
    .eq("is_current", true);

  if (error) {
    return failDb("clearAllCurrentYears", error.message);
  }
  return { ok: true };
}

export async function createSchoolYearAction(
  _prev: SchoolYearMutationState | undefined,
  formData: FormData,
): Promise<SchoolYearMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const label = canonicalizeSchoolYearLabel(trimStr(formData.get("label"), 200));
  const startsRaw = trimStr(formData.get("startsOn"), 32);
  const endsRaw = trimStr(formData.get("endsOn"), 32);
  const makeCurrent = String(formData.get("makeCurrent") ?? "") === "on";

  if (!label) {
    return { ok: false, error: "School year label is required." };
  }

  const dates = parseYearDates(startsRaw, endsRaw);
  if (!dates.ok) return dates;

  const available = await assertLabelAvailable(ctx.supabase, label);
  if (!available.ok) return available;

  const { data: existingCurrent, error: currentErr } = await ctx.supabase
    .from("school_years")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();

  if (currentErr) {
    return failDb("createSchoolYear.loadCurrent", currentErr.message);
  }

  const shouldBeCurrent = makeCurrent || !existingCurrent?.id;

  if (shouldBeCurrent) {
    const cleared = await clearAllCurrentYears(ctx.supabase);
    if (!cleared.ok) return cleared;
  }

  const { error } = await ctx.supabase.from("school_years").insert({
    label,
    starts_on: dates.startsOn,
    ends_on: dates.endsOn,
    is_current: shouldBeCurrent,
    archived_at: null,
  });

  if (error) {
    return failDb("createSchoolYear", error.message);
  }

  revalidateSchoolStructure(ctx.role);
  return {
    ok: true,
    message: shouldBeCurrent
      ? `School year “${label}” was created and set as Current.`
      : `School year “${label}” was created.`,
  };
}

export async function updateSchoolYearAction(
  _prev: SchoolYearMutationState | undefined,
  formData: FormData,
): Promise<SchoolYearMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("schoolYearId"), 64);
  const label = canonicalizeSchoolYearLabel(trimStr(formData.get("label"), 200));
  const startsRaw = trimStr(formData.get("startsOn"), 32);
  const endsRaw = trimStr(formData.get("endsOn"), 32);

  if (!isUuid(id)) {
    return { ok: false, error: "Invalid school year." };
  }
  if (!label) {
    return { ok: false, error: "School year label is required." };
  }

  const dates = parseYearDates(startsRaw, endsRaw);
  if (!dates.ok) return dates;

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("school_years")
    .select("id, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failDb("updateSchoolYear.load", loadErr.message);
  }
  if (!existing?.id) {
    return { ok: false, error: "School year was not found." };
  }
  if (existing.archived_at) {
    return {
      ok: false,
      error: "Restore this school year before editing its label or dates.",
    };
  }

  const available = await assertLabelAvailable(ctx.supabase, label, id);
  if (!available.ok) return available;

  const { error } = await ctx.supabase
    .from("school_years")
    .update({
      label,
      starts_on: dates.startsOn,
      ends_on: dates.endsOn,
    })
    .eq("id", id);

  if (error) {
    return failDb("updateSchoolYear", error.message);
  }

  revalidateSchoolStructure(ctx.role);
  return { ok: true, message: `School year “${label}” was updated.` };
}

export async function setCurrentSchoolYearAction(
  _prev: SchoolYearMutationState | undefined,
  formData: FormData,
): Promise<SchoolYearMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("schoolYearId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid school year." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("school_years")
    .select("id, label, is_current, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failDb("setCurrentSchoolYear.load", loadErr.message);
  }
  if (!existing?.id) {
    return { ok: false, error: "School year was not found." };
  }
  if (existing.archived_at) {
    return { ok: false, error: "Restore this school year before setting it as Current." };
  }
  if (existing.is_current) {
    return { ok: true, message: `“${existing.label}” is already the Current school year.` };
  }

  const cleared = await clearAllCurrentYears(ctx.supabase);
  if (!cleared.ok) return cleared;

  const { error } = await ctx.supabase
    .from("school_years")
    .update({ is_current: true })
    .eq("id", id);

  if (error) {
    return failDb("setCurrentSchoolYear", error.message);
  }

  revalidateSchoolStructure(ctx.role);
  return { ok: true, message: `“${existing.label}” is now the Current school year.` };
}

export async function archiveSchoolYearAction(
  _prev: SchoolYearMutationState | undefined,
  formData: FormData,
): Promise<SchoolYearMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("schoolYearId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid school year." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("school_years")
    .select("id, label, is_current, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failDb("archiveSchoolYear.load", loadErr.message);
  }
  if (!existing?.id) {
    return { ok: false, error: "School year was not found." };
  }
  if (existing.archived_at) {
    return { ok: false, error: "This school year is already archived." };
  }

  const { error } = await ctx.supabase
    .from("school_years")
    .update({
      archived_at: new Date().toISOString(),
      is_current: false,
    })
    .eq("id", id);

  if (error) {
    return failDb("archiveSchoolYear", error.message);
  }

  if (existing.is_current) {
    // Dependency-aware next Current (same rules as migration backfill) — never
    // arbitrary among near-empty duplicates.
    const { data: candidates, error: nextErr } = await ctx.supabase
      .from("school_years")
      .select("id, starts_on, ends_on")
      .is("archived_at", null)
      .order("starts_on", { ascending: false });

    if (nextErr) {
      logSchoolSettingsError("archiveSchoolYear.nextCurrent", nextErr.message);
      return failDb("archiveSchoolYear.nextCurrent", nextErr.message);
    }

    const picked = await pickPreferredSchoolYearId(
      ctx.supabase,
      candidates ?? [],
    );
    if (!picked.ok) {
      return { ok: false, error: picked.error };
    }

    if (picked.id) {
      const { error: setErr } = await ctx.supabase
        .from("school_years")
        .update({ is_current: true })
        .eq("id", picked.id);
      if (setErr) {
        return failDb("archiveSchoolYear.setNextCurrent", setErr.message);
      }
    }
  }

  revalidateSchoolStructure(ctx.role);
  return {
    ok: true,
    message: `“${existing.label}” was archived. Classes and records for that year are kept.`,
  };
}

export async function restoreSchoolYearAction(
  _prev: SchoolYearMutationState | undefined,
  formData: FormData,
): Promise<SchoolYearMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const id = trimStr(formData.get("schoolYearId"), 64);
  if (!isUuid(id)) {
    return { ok: false, error: "Invalid school year." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("school_years")
    .select("id, label, archived_at")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return failDb("restoreSchoolYear.load", loadErr.message);
  }
  if (!existing?.id) {
    return { ok: false, error: "School year was not found." };
  }
  if (!existing.archived_at) {
    return { ok: false, error: "This school year is not archived." };
  }

  const { error } = await ctx.supabase
    .from("school_years")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return failDb("restoreSchoolYear", error.message);
  }

  revalidateSchoolStructure(ctx.role);
  return { ok: true, message: `“${existing.label}” was restored.` };
}
