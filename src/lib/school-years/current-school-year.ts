import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import type { Database } from "@/types/database.types";

export type CurrentSchoolYear = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
};

export type LoadCurrentSchoolYearResult =
  | { ok: true; year: CurrentSchoolYear | null }
  | { ok: false; error: string };

type SchoolYearsClient = SupabaseClient<Database>;

/**
 * Resolves the school's Current school year from `school_years.is_current`.
 *
 * Canonical model (migration `20260807121000_school_years_current_and_archive`):
 * - `is_current boolean NOT NULL DEFAULT false`
 * - at most one current via partial unique index `school_years_one_current_uidx`
 * - `archived_at` soft-archives without deleting history / FKs
 *
 * Admin sets Current in School Settings. Date-range heuristics are not used here.
 * Schema / query failures are logged server-side; callers receive safe UI copy only.
 */
export async function loadCurrentSchoolYear(
  supabase: SchoolYearsClient,
): Promise<LoadCurrentSchoolYearResult> {
  const { data, error } = await supabase
    .from("school_years")
    .select("id, label, starts_on, ends_on")
    .eq("is_current", true)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    logServerError("school-years.loadCurrentSchoolYear", error.message);
    return { ok: false, error: GENERIC_INFORMATION_LOAD_ERROR };
  }

  if (!data?.id) {
    return { ok: true, year: null };
  }

  return {
    ok: true,
    year: {
      id: data.id,
      label: data.label?.trim() || data.label,
      starts_on: data.starts_on,
      ends_on: data.ends_on,
    },
  };
}

/** Alias — same resolver; prefer this name at call sites that expect “get”. */
export const getCurrentSchoolYear = loadCurrentSchoolYear;

/** Convenience: current year label for report-card / completion matching. */
export async function loadCurrentSchoolYearLabel(
  supabase: SchoolYearsClient,
): Promise<{ ok: true; label: string | null } | { ok: false; error: string }> {
  const result = await loadCurrentSchoolYear(supabase);
  if (!result.ok) return result;
  const label = result.year?.label?.trim() || null;
  return { ok: true, label };
}

export type SchoolYearCandidate = {
  id: string;
  starts_on: string;
  ends_on: string;
};

/**
 * Dependency-aware pick for a next Current year (e.g. after archiving Current).
 * Prefer date range containing today, then most classes+enrollments, then latest starts_on.
 * Does not delete or merge duplicates.
 */
export async function pickPreferredSchoolYearId(
  supabase: SchoolYearsClient,
  candidates: SchoolYearCandidate[],
  todayIso: string = new Date().toISOString().slice(0, 10),
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (candidates.length === 0) {
    return { ok: true, id: null };
  }

  const scored: { id: string; starts_on: string; inRange: number; depCount: number }[] =
    [];

  for (const candidate of candidates) {
    const [classesRes, enrollmentsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("school_year_id", candidate.id),
      supabase
        .from("student_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("school_year_id", candidate.id),
    ]);

    if (classesRes.error) {
      logServerError("school-years.pickPreferred.classes", classesRes.error.message);
      return { ok: false, error: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (enrollmentsRes.error) {
      logServerError(
        "school-years.pickPreferred.enrollments",
        enrollmentsRes.error.message,
      );
      return { ok: false, error: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const inRange =
      candidate.starts_on <= todayIso && todayIso <= candidate.ends_on ? 0 : 1;
    scored.push({
      id: candidate.id,
      starts_on: candidate.starts_on,
      inRange,
      depCount: (classesRes.count ?? 0) + (enrollmentsRes.count ?? 0),
    });
  }

  scored.sort((a, b) => {
    if (a.inRange !== b.inRange) return a.inRange - b.inRange;
    if (b.depCount !== a.depCount) return b.depCount - a.depCount;
    return b.starts_on.localeCompare(a.starts_on);
  });

  return { ok: true, id: scored[0]?.id ?? null };
}
