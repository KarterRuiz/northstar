import "server-only";

import { cache } from "react";

import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ClassInviteOption = {
  id: string;
  /** Full row label (year · grade · class · optional section). */
  label: string;
  schoolYearLabel: string;
  gradeLevelId: string;
  gradeName: string;
  /** Mirrors `grade_levels.sort_order` for stable grouping and future grade filters. */
  gradeSortOrder: number;
  className: string;
  section: string | null;
};

export const loadActiveClassesForStaffInvite = cache(
  async (): Promise<ClassInviteOption[]> => {
    if (!isSupabaseConfigured()) return [];

    const supabase = await createServerSupabaseClient();
    const actor = await getStaffDirectoryManagerActor(supabase);
    if (!actor) return [];

    const [yearsRes, gradesRes, classesRes] = await Promise.all([
      supabase.from("school_years").select("id, label").order("starts_on", { ascending: false }),
      supabase.from("grade_levels").select("id, name, sort_order").order("sort_order", { ascending: true }),
      supabase
        .from("classes")
        .select("id, name, section, school_year_id, grade_level_id")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (yearsRes.error || gradesRes.error || classesRes.error) return [];

    const yearLabel = new Map((yearsRes.data ?? []).map((y) => [y.id, y.label]));
    const gradeById = new Map(
      (gradesRes.data ?? []).map((g) => [
        g.id,
        { name: g.name, sortOrder: typeof g.sort_order === "number" ? g.sort_order : 0 },
      ]),
    );

    const rows = (classesRes.data ?? []).map((row) => {
      const yl = yearLabel.get(row.school_year_id) ?? "—";
      const grade = gradeById.get(row.grade_level_id);
      const gn = grade?.name ?? "—";
      const gradeSortOrder = grade?.sortOrder ?? 999;
      const section = row.section?.trim() ? row.section.trim() : null;
      const bits = [yl, gn, row.name, section ? `§ ${section}` : null].filter(Boolean) as string[];
      return {
        id: row.id,
        label: bits.join(" · "),
        schoolYearLabel: yl,
        gradeLevelId: row.grade_level_id,
        gradeName: gn,
        gradeSortOrder,
        className: row.name,
        section,
      };
    });

    rows.sort((a, b) => {
      if (a.gradeSortOrder !== b.gradeSortOrder) return a.gradeSortOrder - b.gradeSortOrder;
      return a.className.localeCompare(b.className, undefined, { sensitivity: "base" });
    });

    return rows;
  },
);
