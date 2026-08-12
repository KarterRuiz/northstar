import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { formatStaffMemberAssignmentLabel } from "@/lib/staff/class-assignable-staff";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { Database } from "@/types/database.types";

import {
  classMatchesFilters,
  operationalFiltersFrom,
  parseClassManagementFilters,
  summarizeClassManagementMetrics,
  type ClassManagementAppliedFilters,
} from "./class-management-filters";
import { loadEligibleClassStaffOptions } from "./class-staff-assignments";

export type { ClassManagementAppliedFilters } from "./class-management-filters";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
export type SchoolYearRow = Database["public"]["Tables"]["school_years"]["Row"];
export type GradeLevelRow = Database["public"]["Tables"]["grade_levels"]["Row"];

export type TeacherOption = {
  /** staff_members.id */
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  /** Linked auth profile when activated; null for pre-activation roster rows. */
  profile_id: string | null;
  label: string;
};

export type ClassTeacherDisplay = {
  id: string;
  /** staff_members.id — stable assignment identity. */
  staffMemberId: string;
  /** Linked profile when activated; null for pre-activation assignments. */
  teacherProfileId: string | null;
  role: string;
  teacherRole: string;
  teacherLabel: string;
};

export type ClassManagementClassRow = ClassRow & {
  schoolYearLabel: string;
  gradeLevelName: string;
  teachers: ClassTeacherDisplay[];
  /** Active student_enrollments rows for this class. */
  studentEnrollmentCount: number;
  /** True when the class has no enrollments or academic artifacts (safe to hard-delete). */
  deletable: boolean;
};

export type ClassManagementGradeFilterOption = {
  id: string;
  name: string;
};

export type ClassManagementOperationalSummary = {
  classCount: number;
  teacherCount: number;
  studentCount: number;
  /** Total archived classes (unfiltered by search/grade) — for archive access affordance. */
  archivedClassCount: number;
};

export type ClassManagementPageData =
  | {
      ok: true;
      schoolYears: SchoolYearRow[];
      gradeLevels: GradeLevelRow[];
      /** Filtered classes for the overview table (default: active only). */
      classes: ClassManagementClassRow[];
      teachers: TeacherOption[];
      /** Distinct grade levels that appear on any class (for filter dropdown). */
      gradeFilterOptions: ClassManagementGradeFilterOption[];
      appliedFilters: ClassManagementAppliedFilters;
      /** Count of all classes before URL filters (search / status / grade). */
      totalClassCount: number;
      /** Active-class operational pulse (ignores archive status filter). */
      operationalSummary: ClassManagementOperationalSummary;
    }
  | { ok: false; message: string };

export async function loadClassManagementPageData(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<ClassManagementPageData> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: GENERIC_INFORMATION_LOAD_ERROR,
    };
  }

  const supabase = await createServerSupabaseClient();

  // grade_levels.is_archived requires migration 20260807120000_grade_levels_archive_and_code_unique.
  // school_years.is_current / archived_at require migration 20260807121000_school_years_current_and_archive.
  const [yearsRes, gradesRes, classesRes, teachersRes] = await Promise.all([
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
    supabase
      .from("classes")
      .select(
        "id, school_year_id, grade_level_id, name, section, is_active, created_at, updated_at",
      )
      .order("name", { ascending: true }),
    loadEligibleClassStaffOptions(supabase),
  ]);

  if (yearsRes.error) {
    logServerError("class-management.loadPage.schoolYears", yearsRes.error.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (gradesRes.error) {
    logServerError("class-management.loadPage.gradeLevels", gradesRes.error.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (classesRes.error) {
    logServerError("class-management.loadPage.classes", classesRes.error.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }
  if (!teachersRes.ok) {
    logServerError("class-management.loadPage.teachers", teachersRes.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const schoolYears = (yearsRes.data ?? []) as SchoolYearRow[];
  const allGradeLevels = (gradesRes.data ?? []) as GradeLevelRow[];
  /** Active grades only — used for class create pickers. */
  const gradeLevels = allGradeLevels.filter((g) => !g.is_archived);
  const validGradeIds = new Set(allGradeLevels.map((g) => g.id));
  const appliedFilters = parseClassManagementFilters(searchParams, validGradeIds);
  const classRows = (classesRes.data ?? []) as ClassRow[];
  const teachers: TeacherOption[] = teachersRes.teachers;

  const yearById = new Map(schoolYears.map((y) => [y.id, y]));
  const gradeById = new Map(allGradeLevels.map((g) => [g.id, g]));

  type StaffClassRow = {
    id: string;
    class_id: string;
    staff_member_id: string;
    role: string;
  };

  let staffClassRows: StaffClassRow[] = [];
  if (classRows.length > 0) {
    const ids = classRows.map((c) => c.id);
    const smcRes = await supabase
      .from("staff_member_classes")
      .select("id, class_id, staff_member_id, role")
      .in("class_id", ids);
    if (smcRes.error) {
      logServerError("class-management.loadStaffMemberClasses", smcRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    staffClassRows = (smcRes.data ?? []) as StaffClassRow[];
  }

  const staffMemberIds = [...new Set(staffClassRows.map((t) => t.staff_member_id))];
  const staffById = new Map<
    string,
    {
      role: string;
      full_name: string | null;
      email: string | null;
      profile_id: string | null;
      first_name: string | null;
      last_name: string | null;
    }
  >();
  if (staffMemberIds.length > 0) {
    const staffRes = await supabase
      .from("staff_members")
      .select("id, role, full_name, email, profile_id, first_name, last_name")
      .in("id", staffMemberIds);
    if (staffRes.error) {
      logServerError("class-management.loadStaffMembers", staffRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    for (const row of staffRes.data ?? []) {
      if (row?.id) {
        staffById.set(row.id, {
          role: row.role ?? "",
          full_name: row.full_name ?? null,
          email: row.email ?? null,
          profile_id: row.profile_id ?? null,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
        });
      }
    }
  }

  const teachersByClass = new Map<string, ClassTeacherDisplay[]>();
  for (const row of staffClassRows) {
    const list = teachersByClass.get(row.class_id) ?? [];
    const staff = staffById.get(row.staff_member_id);
    list.push({
      id: row.id,
      staffMemberId: row.staff_member_id,
      teacherProfileId: staff?.profile_id ?? null,
      role: row.role,
      teacherRole: staff?.role ?? "",
      teacherLabel: formatStaffMemberAssignmentLabel({
        full_name: staff?.full_name,
        first_name: staff?.first_name,
        last_name: staff?.last_name,
        email: staff?.email,
        role: staff?.role,
      }),
    });
    teachersByClass.set(row.class_id, list);
  }

  const enrollmentCountByClassId = new Map<string, number>();
  if (classRows.length > 0) {
    const ids = classRows.map((c) => c.id);
    const enrRes = await supabase
      .from("student_enrollments")
      .select("class_id")
      .in("class_id", ids)
      .eq("status", "active");
    if (enrRes.error) {
      logServerError("class-management.loadEnrollments", enrRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    for (const row of enrRes.data ?? []) {
      const cid = row.class_id;
      enrollmentCountByClassId.set(cid, (enrollmentCountByClassId.get(cid) ?? 0) + 1);
    }
  }

  const deletableByClassId = new Map<string, boolean>();
  if (classRows.length > 0) {
    const deletableResults = await Promise.all(
      classRows.map(async (c) => {
        const { data, error } = await supabase.rpc("class_is_deletable", {
          p_class_id: c.id,
        });
        return { id: c.id, deletable: !error && data === true };
      }),
    );
    for (const row of deletableResults) {
      deletableByClassId.set(row.id, row.deletable);
    }
  }

  const classesUnfiltered: ClassManagementClassRow[] = classRows.map((c) => ({
    ...c,
    schoolYearLabel: yearById.get(c.school_year_id)?.label ?? c.school_year_id,
    gradeLevelName: gradeById.get(c.grade_level_id)?.name ?? c.grade_level_id,
    teachers: (teachersByClass.get(c.id) ?? []).sort((a, b) =>
      a.role.localeCompare(b.role),
    ),
    studentEnrollmentCount: enrollmentCountByClassId.get(c.id) ?? 0,
    deletable: deletableByClassId.get(c.id) ?? false,
  }));

  const gradeIdSet = new Set(classesUnfiltered.map((c) => c.grade_level_id));
  const gradeFilterOptions: ClassManagementGradeFilterOption[] = allGradeLevels
    .filter((g) => gradeIdSet.has(g.id))
    .map((g) => ({ id: g.id, name: g.name }));

  const classes = classesUnfiltered.filter((c) => classMatchesFilters(c, appliedFilters));

  const operationalRows = classesUnfiltered.filter((c) =>
    classMatchesFilters(c, operationalFiltersFrom(appliedFilters)),
  );
  const metrics = summarizeClassManagementMetrics(operationalRows);
  const archivedClassCount = classesUnfiltered.filter((c) => !c.is_active).length;

  return {
    ok: true,
    schoolYears,
    gradeLevels,
    classes,
    teachers,
    gradeFilterOptions,
    appliedFilters,
    totalClassCount: classesUnfiltered.length,
    operationalSummary: {
      ...metrics,
      archivedClassCount,
    },
  };
}
