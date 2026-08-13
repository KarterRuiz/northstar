import "server-only";

import { cache } from "react";

import { loadEligibleClassStaffOptions } from "@/features/classes/class-staff-assignments";
import type {
  GradeLevelRow,
  SchoolYearRow,
  TeacherOption,
} from "@/features/classes/load-class-management-data";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ClassDataCenterManagementOptions = {
  teachers: TeacherOption[];
  schoolYears: SchoolYearRow[];
  gradeLevels: GradeLevelRow[];
};

export const loadClassDataCenterManagementOptions = cache(
  async (): Promise<ClassDataCenterManagementOptions> => {
    if (!isSupabaseConfigured()) {
      return { teachers: [], schoolYears: [], gradeLevels: [] };
    }

    const supabase = await createServerSupabaseClient();
    const [teachersRes, yearsRes, gradesRes] = await Promise.all([
      loadEligibleClassStaffOptions(supabase),
      supabase
        .from("school_years")
        .select("id, label, starts_on, ends_on, is_current, archived_at, created_at, updated_at")
        .is("archived_at", null)
        .order("is_current", { ascending: false })
        .order("starts_on", { ascending: false }),
      supabase
        .from("grade_levels")
        .select("id, name, sort_order, code, is_archived, created_at, updated_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    if (!teachersRes.ok) {
      logServerError("class-data-center.managementTeachers", teachersRes.message);
    }
    if (yearsRes.error) {
      logServerError("class-data-center.managementYears", yearsRes.error.message);
    }
    if (gradesRes.error) {
      logServerError("class-data-center.managementGrades", gradesRes.error.message);
    }

    if (yearsRes.error || gradesRes.error) {
      // Soft degrade — Actions still render; edit dialogs stay closed until data loads.
      void GENERIC_INFORMATION_LOAD_ERROR;
    }

    return {
      teachers: teachersRes.ok ? teachersRes.teachers : [],
      schoolYears: (yearsRes.data ?? []) as SchoolYearRow[],
      gradeLevels: (gradesRes.data ?? []) as GradeLevelRow[],
    };
  },
);
