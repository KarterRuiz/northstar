import { formatStaffProfileLabel } from "@/lib/staff/format-staff-profile-label";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { Database } from "@/types/database.types";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
export type SchoolYearRow = Database["public"]["Tables"]["school_years"]["Row"];
export type GradeLevelRow = Database["public"]["Tables"]["grade_levels"]["Row"];
type ClassTeacherRow = Database["public"]["Tables"]["class_teachers"]["Row"];

export type TeacherOption = {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  label: string;
};

export type ClassTeacherDisplay = {
  id: string;
  teacherProfileId: string;
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

export type ClassManagementAppliedFilters = {
  q: string;
  status: "all" | "active" | "archived";
  gradeLevelId: string | null;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseClassManagementFilters(
  raw: Record<string, string | string[] | undefined> | undefined,
  validGradeIds: Set<string>,
): ClassManagementAppliedFilters {
  const qRaw = firstParam(raw?.q) ?? "";
  const q = qRaw.trim().slice(0, 200);

  const statusRaw = (firstParam(raw?.status) ?? "all").toLowerCase();
  const status: ClassManagementAppliedFilters["status"] =
    statusRaw === "active" || statusRaw === "archived" ? statusRaw : "all";

  const gradeRaw = firstParam(raw?.grade)?.trim() ?? "";
  const gradeLevelId = validGradeIds.has(gradeRaw) ? gradeRaw : null;

  return { q, status, gradeLevelId };
}

function classMatchesFilters(
  row: ClassManagementClassRow,
  filters: ClassManagementAppliedFilters,
): boolean {
  if (filters.status === "active" && !row.is_active) return false;
  if (filters.status === "archived" && row.is_active) return false;

  if (filters.gradeLevelId && row.grade_level_id !== filters.gradeLevelId) {
    return false;
  }

  if (!filters.q) return true;

  const needle = filters.q.toLowerCase();
  const teacherText = row.teachers.map((t) => t.teacherLabel).join(" ").toLowerCase();
  const hay = [
    row.name,
    row.section ?? "",
    row.gradeLevelName,
    teacherText,
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes(needle);
}

export type ClassManagementPageData =
  | {
      ok: true;
      schoolYears: SchoolYearRow[];
      gradeLevels: GradeLevelRow[];
      /** Classes matching URL filters (`q`, `status`, `grade`). */
      classes: ClassManagementClassRow[];
      /** Full class list (ignores URL filters) for admin forms such as teacher assignment. */
      allClasses: ClassManagementClassRow[];
      teachers: TeacherOption[];
      /** Distinct grade levels that appear on any class (for filter dropdown). */
      gradeFilterOptions: ClassManagementGradeFilterOption[];
      appliedFilters: ClassManagementAppliedFilters;
      /** Count of all classes before URL filters (search / status / grade). */
      totalClassCount: number;
    }
  | { ok: false; message: string };

export async function loadClassManagementPageData(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<ClassManagementPageData> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Supabase is not configured (missing URL or anon key).",
    };
  }

  const supabase = await createServerSupabaseClient();

  const [yearsRes, gradesRes, classesRes, teachersRes] = await Promise.all([
    supabase
      .from("school_years")
      .select("id, label, starts_on, ends_on")
      .order("starts_on", { ascending: false }),
    supabase
      .from("grade_levels")
      .select("id, name, sort_order, code")
      .order("sort_order", { ascending: true }),
    supabase
      .from("classes")
      .select(
        "id, school_year_id, grade_level_id, name, section, is_active, created_at, updated_at",
      )
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("role", "teacher")
      .order("full_name", { ascending: true, nullsFirst: false })
      .order("id"),
  ]);

  const firstErr =
    yearsRes.error?.message ||
    gradesRes.error?.message ||
    classesRes.error?.message ||
    teachersRes.error?.message;

  if (firstErr) {
    return { ok: false, message: firstErr };
  }

  const schoolYears = (yearsRes.data ?? []) as SchoolYearRow[];
  const gradeLevels = (gradesRes.data ?? []) as GradeLevelRow[];
  const validGradeIds = new Set(gradeLevels.map((g) => g.id));
  const appliedFilters = parseClassManagementFilters(searchParams, validGradeIds);
  const classRows = (classesRes.data ?? []) as ClassRow[];
  const teachers: TeacherOption[] = (teachersRes.data ?? []).map((row) => ({
    id: row.id,
    role: row.role ?? "teacher",
    full_name: row.full_name ?? null,
    email: row.email ?? null,
    label: formatStaffProfileLabel({
      id: row.id,
      role: row.role,
      full_name: row.full_name,
      email: row.email,
    }),
  }));

  const yearById = new Map(schoolYears.map((y) => [y.id, y]));
  const gradeById = new Map(gradeLevels.map((g) => [g.id, g]));

  let classTeachers: ClassTeacherRow[] = [];
  if (classRows.length > 0) {
    const ids = classRows.map((c) => c.id);
    const ctRes = await supabase
      .from("class_teachers")
      .select("id, class_id, teacher_profile_id, role")
      .in("class_id", ids);
    if (ctRes.error) {
      return { ok: false, message: ctRes.error.message };
    }
    classTeachers = (ctRes.data ?? []) as ClassTeacherRow[];
  }

  const teacherIds = [...new Set(classTeachers.map((t) => t.teacher_profile_id))];
  const profileById = new Map<
    string,
    { role: string; full_name: string | null; email: string | null }
  >();
  if (teacherIds.length > 0) {
    const profRes = await supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .in("id", teacherIds);
    if (profRes.error) {
      return { ok: false, message: profRes.error.message };
    }
    for (const row of profRes.data ?? []) {
      if (row?.id) {
        profileById.set(row.id, {
          role: row.role ?? "",
          full_name: row.full_name ?? null,
          email: row.email ?? null,
        });
      }
    }
  }

  const teachersByClass = new Map<string, ClassTeacherDisplay[]>();
  for (const ct of classTeachers) {
    const list = teachersByClass.get(ct.class_id) ?? [];
    const prof = profileById.get(ct.teacher_profile_id);
    list.push({
      id: ct.id,
      teacherProfileId: ct.teacher_profile_id,
      role: ct.role,
      teacherRole: prof?.role ?? "",
      teacherLabel: formatStaffProfileLabel({
        id: ct.teacher_profile_id,
        role: prof?.role,
        full_name: prof?.full_name,
        email: prof?.email,
      }),
    });
    teachersByClass.set(ct.class_id, list);
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
      return { ok: false, message: enrRes.error.message };
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
  const gradeFilterOptions: ClassManagementGradeFilterOption[] = gradeLevels
    .filter((g) => gradeIdSet.has(g.id))
    .map((g) => ({ id: g.id, name: g.name }));

  const classes = classesUnfiltered.filter((c) => classMatchesFilters(c, appliedFilters));

  return {
    ok: true,
    schoolYears,
    gradeLevels,
    classes,
    allClasses: classesUnfiltered,
    teachers,
    gradeFilterOptions,
    appliedFilters,
    totalClassCount: classesUnfiltered.length,
  };
}
