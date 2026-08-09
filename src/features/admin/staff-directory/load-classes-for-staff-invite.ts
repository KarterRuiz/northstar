import "server-only";

import { cache } from "react";

import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type GradeInviteOption = {
  id: string;
  name: string;
  sortOrder: number;
  code: string | null;
};

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

export type StaffInviteAccessOptions = {
  grades: GradeInviteOption[];
  classes: ClassInviteOption[];
};

export const loadStaffInviteAccessOptions = cache(
  async (): Promise<StaffInviteAccessOptions> => {
    if (!isSupabaseConfigured()) return { grades: [], classes: [] };

    const supabase = await createServerSupabaseClient();
    const actor = await getStaffDirectoryManagerActor(supabase);
    if (!actor) return { grades: [], classes: [] };

    const [yearsRes, gradesRes, classesRes] = await Promise.all([
      supabase.from("school_years").select("id, label").order("starts_on", { ascending: false }),
      supabase
        .from("grade_levels")
        .select("id, name, sort_order, code, is_archived")
        .eq("is_archived", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("classes")
        .select("id, name, section, school_year_id, grade_level_id")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (yearsRes.error || gradesRes.error || classesRes.error) {
      return { grades: [], classes: [] };
    }

    const grades: GradeInviteOption[] = (gradesRes.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: typeof g.sort_order === "number" ? g.sort_order : 0,
      code: g.code?.trim() || null,
    }));

    const yearLabel = new Map((yearsRes.data ?? []).map((y) => [y.id, y.label]));
    const gradeById = new Map(grades.map((g) => [g.id, g]));

    const classes = (classesRes.data ?? []).map((row) => {
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

    classes.sort((a, b) => {
      if (a.gradeSortOrder !== b.gradeSortOrder) return a.gradeSortOrder - b.gradeSortOrder;
      const byGrade = a.gradeName.localeCompare(b.gradeName, undefined, { sensitivity: "base" });
      if (byGrade !== 0) return byGrade;
      return a.className.localeCompare(b.className, undefined, { sensitivity: "base" });
    });

    return { grades, classes };
  },
);

/** @deprecated Prefer `loadStaffInviteAccessOptions().classes`. */
export const loadActiveClassesForStaffInvite = cache(async (): Promise<ClassInviteOption[]> => {
  const { classes } = await loadStaffInviteAccessOptions();
  return classes;
});
