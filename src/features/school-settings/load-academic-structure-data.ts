import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { missingStandardTermCodes } from "@/lib/school-years/school-year-integrity";

import type { GradeLevelRow, SchoolYearRow } from "@/features/classes/load-class-management-data";
import { logSchoolSettingsError } from "@/features/school-settings/safe-admin-error";

export type GradeLevelListItem = GradeLevelRow & {
  classCount: number;
};

export type TermListItem = {
  id: string;
  school_year_id: string;
  code: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
};

export type CurrentYearTermsSummary = {
  schoolYearId: string;
  schoolYearLabel: string;
  terms: TermListItem[];
  missingCodes: string[];
  datesUnsetCount: number;
};

export type AcademicStructurePageData =
  | {
      ok: true;
      schoolYears: SchoolYearRow[];
      gradeLevels: GradeLevelListItem[];
      currentYearTerms: CurrentYearTermsSummary | null;
    }
  | { ok: false; message: string };

const ACADEMIC_STRUCTURE_LOAD_ERROR =
  "We couldn’t load this information. Try again.";

export async function loadAcademicStructurePageData(): Promise<AcademicStructurePageData> {
  if (!isSupabaseConfigured()) {
    logSchoolSettingsError("loadAcademicStructure", "Supabase is not configured");
    return { ok: false, message: ACADEMIC_STRUCTURE_LOAD_ERROR };
  }

  const supabase = await createServerSupabaseClient();

  // Uses school_years.is_current / archived_at (migration 20260807121000).
  // Schema failures must surface as ok:false — never empty success.
  const [yearsRes, gradesRes, classCountsRes] = await Promise.all([
    supabase
      .from("school_years")
      .select("id, label, starts_on, ends_on, is_current, archived_at, created_at, updated_at")
      .order("is_current", { ascending: false })
      .order("starts_on", { ascending: false }),
    // Requires migration 20260807120000_grade_levels_archive_and_code_unique (is_archived).
    supabase
      .from("grade_levels")
      .select("id, name, sort_order, code, is_archived, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("classes").select("grade_level_id"),
  ]);

  if (yearsRes.error) {
    logSchoolSettingsError("loadAcademicStructure.schoolYears", yearsRes.error.message);
    return { ok: false, message: ACADEMIC_STRUCTURE_LOAD_ERROR };
  }
  if (gradesRes.error) {
    logSchoolSettingsError("loadAcademicStructure.gradeLevels", gradesRes.error.message);
    return { ok: false, message: ACADEMIC_STRUCTURE_LOAD_ERROR };
  }
  if (classCountsRes.error) {
    logSchoolSettingsError("loadAcademicStructure.classCounts", classCountsRes.error.message);
    return { ok: false, message: ACADEMIC_STRUCTURE_LOAD_ERROR };
  }

  const schoolYears = (yearsRes.data ?? []) as SchoolYearRow[];
  const currentYear =
    schoolYears.find((y) => y.is_current && !y.archived_at) ?? null;

  let currentYearTerms: CurrentYearTermsSummary | null = null;
  if (currentYear) {
    const termsRes = await supabase
      .from("terms")
      .select("id, school_year_id, code, name, starts_on, ends_on")
      .eq("school_year_id", currentYear.id)
      .order("code", { ascending: true });

    if (termsRes.error) {
      logSchoolSettingsError("loadAcademicStructure.terms", termsRes.error.message);
      return { ok: false, message: ACADEMIC_STRUCTURE_LOAD_ERROR };
    }

    const terms = (termsRes.data ?? []) as TermListItem[];
    currentYearTerms = {
      schoolYearId: currentYear.id,
      schoolYearLabel: currentYear.label,
      terms,
      missingCodes: missingStandardTermCodes(terms.map((t) => t.code)),
      datesUnsetCount: terms.filter((t) => !t.starts_on || !t.ends_on).length,
    };
  }

  const counts = new Map<string, number>();
  for (const row of classCountsRes.data ?? []) {
    const id = row.grade_level_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const gradeLevels: GradeLevelListItem[] = ((gradesRes.data ?? []) as GradeLevelRow[]).map(
    (g) => ({
      ...g,
      classCount: counts.get(g.id) ?? 0,
    }),
  );

  return {
    ok: true,
    schoolYears,
    gradeLevels,
    currentYearTerms,
  };
}
