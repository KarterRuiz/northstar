"use server";

import { revalidatePath } from "next/cache";

import { canManageSchoolStructure, type Role } from "@/config/roles";
import { getProfileRole } from "@/lib/auth/session";
import {
  missingStandardTermCodes,
  STANDARD_TERM_CODES,
  standardTermName,
  type StandardTermCode,
} from "@/lib/school-years/school-year-integrity";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  logSchoolSettingsError,
  schoolYearDbErrorMessage,
} from "./safe-admin-error";

export type TermMutationState =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_TERM_ERROR = "Terms could not be updated. Try again.";

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
    error: schoolYearDbErrorMessage(message, GENERIC_TERM_ERROR),
  };
}

async function requireStructureManager(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      role: Role;
    }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    logSchoolSettingsError("requireStructureManager.terms", "Supabase is not configured");
    return { ok: false, error: GENERIC_TERM_ERROR };
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

  return { ok: true, supabase, role };
}

function revalidateTermPaths(role: Role) {
  revalidatePath(`/dashboard/${role}/school-settings`);
  revalidatePath(`/dashboard/${role}/report-cards`);
  revalidatePath(`/dashboard/${role}`);
}

/**
 * Creates missing T1–T4 rows for a school year with null date ranges.
 * Does not invent calendar dates — admin must set starts/ends when known.
 * Requires migration 20260913200000_terms_dates_nullable (nullable starts_on/ends_on).
 */
export async function ensureStandardTermsAction(
  _prev: TermMutationState | undefined,
  formData: FormData,
): Promise<TermMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const schoolYearId = trimStr(formData.get("schoolYearId"), 64);
  if (!isUuid(schoolYearId)) {
    return { ok: false, error: "Invalid school year." };
  }

  const { data: year, error: yearErr } = await ctx.supabase
    .from("school_years")
    .select("id, label, archived_at")
    .eq("id", schoolYearId)
    .maybeSingle();

  if (yearErr) return failDb("ensureStandardTerms.loadYear", yearErr.message);
  if (!year?.id) return { ok: false, error: "School year was not found." };
  if (year.archived_at) {
    return { ok: false, error: "Restore this school year before configuring terms." };
  }

  const { data: existing, error: termsErr } = await ctx.supabase
    .from("terms")
    .select("code")
    .eq("school_year_id", schoolYearId);

  if (termsErr) return failDb("ensureStandardTerms.loadTerms", termsErr.message);

  const missing = missingStandardTermCodes((existing ?? []).map((t) => t.code));
  if (missing.length === 0) {
    return {
      ok: true,
      message: `“${year.label}” already has T1–T4. Set term dates when your calendar is ready.`,
    };
  }

  const rows = missing.map((code: StandardTermCode) => ({
    school_year_id: schoolYearId,
    code,
    name: standardTermName(code),
    starts_on: null,
    ends_on: null,
  }));

  const { error: insertErr } = await ctx.supabase.from("terms").insert(rows);
  if (insertErr) return failDb("ensureStandardTerms.insert", insertErr.message);

  revalidateTermPaths(ctx.role);
  return {
    ok: true,
    message: `Created ${missing.join(", ")} for “${year.label}” (dates unset — set them when known).`,
  };
}

/**
 * Updates start/end dates for one term. Empty fields clear the date (null).
 * Null dates keep reporting cycle "not started" for that term.
 */
export async function updateTermDatesAction(
  _prev: TermMutationState | undefined,
  formData: FormData,
): Promise<TermMutationState> {
  const ctx = await requireStructureManager();
  if (!ctx.ok) return ctx;

  const termId = trimStr(formData.get("termId"), 64);
  if (!isUuid(termId)) {
    return { ok: false, error: "Invalid term." };
  }

  const startsRaw = trimStr(formData.get("startsOn"), 32);
  const endsRaw = trimStr(formData.get("endsOn"), 32);

  const startsOn = startsRaw || null;
  const endsOn = endsRaw || null;

  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    return { ok: false, error: "Start date must use YYYY-MM-DD format." };
  }
  if (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return { ok: false, error: "End date must use YYYY-MM-DD format." };
  }
  if (startsOn && endsOn && startsOn > endsOn) {
    return { ok: false, error: "Start date must be on or before end date." };
  }

  const { data: existing, error: loadErr } = await ctx.supabase
    .from("terms")
    .select("id, code")
    .eq("id", termId)
    .maybeSingle();

  if (loadErr) return failDb("updateTermDates.load", loadErr.message);
  if (!existing?.id) return { ok: false, error: "Term was not found." };

  const { error } = await ctx.supabase
    .from("terms")
    .update({ starts_on: startsOn, ends_on: endsOn })
    .eq("id", termId);

  if (error) return failDb("updateTermDates", error.message);

  revalidateTermPaths(ctx.role);
  return {
    ok: true,
    message: `${existing.code} dates updated.`,
  };
}

export { STANDARD_TERM_CODES };
