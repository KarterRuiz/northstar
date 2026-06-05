import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import type { GradeLevelRow, SchoolYearRow } from "@/features/classes/load-class-management-data";

export type AcademicStructurePageData =
  | { ok: true; schoolYears: SchoolYearRow[]; gradeLevels: GradeLevelRow[] }
  | { ok: false; message: string };

export async function loadAcademicStructurePageData(): Promise<AcademicStructurePageData> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Supabase is not configured (missing URL or anon key).",
    };
  }

  const supabase = await createServerSupabaseClient();

  const [yearsRes, gradesRes] = await Promise.all([
    supabase
      .from("school_years")
      .select("id, label, starts_on, ends_on")
      .order("starts_on", { ascending: false }),
    supabase
      .from("grade_levels")
      .select("id, name, sort_order, code")
      .order("sort_order", { ascending: true }),
  ]);

  const firstErr = yearsRes.error?.message || gradesRes.error?.message;
  if (firstErr) {
    return { ok: false, message: firstErr };
  }

  return {
    ok: true,
    schoolYears: (yearsRes.data ?? []) as SchoolYearRow[],
    gradeLevels: (gradesRes.data ?? []) as GradeLevelRow[],
  };
}
