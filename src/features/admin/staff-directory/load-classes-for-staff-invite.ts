import "server-only";

import { cache } from "react";

import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ClassInviteOption = {
  id: string;
  label: string;
};

export const loadActiveClassesForStaffInvite = cache(
  async (): Promise<ClassInviteOption[]> => {
    if (!isSupabaseConfigured()) return [];

    const supabase = await createServerSupabaseClient();
    const actor = await getStaffDirectoryManagerActor(supabase);
    if (!actor) return [];

    const [yearsRes, gradesRes, classesRes] = await Promise.all([
      supabase.from("school_years").select("id, label").order("starts_on", { ascending: false }),
      supabase.from("grade_levels").select("id, name").order("sort_order", { ascending: true }),
      supabase
        .from("classes")
        .select("id, name, section, school_year_id, grade_level_id")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (yearsRes.error || gradesRes.error || classesRes.error) return [];

    const yearLabel = new Map((yearsRes.data ?? []).map((y) => [y.id, y.label]));
    const gradeName = new Map((gradesRes.data ?? []).map((g) => [g.id, g.name]));

    return (classesRes.data ?? []).map((row) => {
      const yl = yearLabel.get(row.school_year_id) ?? "—";
      const gn = gradeName.get(row.grade_level_id) ?? "—";
      const section = row.section?.trim();
      const bits = [yl, gn, row.name, section ? `§ ${section}` : null].filter(Boolean) as string[];
      return {
        id: row.id,
        label: bits.join(" · "),
      };
    });
  },
);
