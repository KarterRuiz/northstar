import { formatStaffProfileLabel } from "@/lib/staff/format-staff-profile-label";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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
  /** True when the class has no enrollments or academic artifacts (safe to hard-delete). */
  deletable: boolean;
};

export type ClassManagementPageData =
  | {
      ok: true;
      schoolYears: SchoolYearRow[];
      gradeLevels: GradeLevelRow[];
      classes: ClassManagementClassRow[];
      teachers: TeacherOption[];
    }
  | { ok: false; message: string };

export async function loadClassManagementPageData(): Promise<ClassManagementPageData> {
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

  const classes: ClassManagementClassRow[] = classRows.map((c) => ({
    ...c,
    schoolYearLabel: yearById.get(c.school_year_id)?.label ?? c.school_year_id,
    gradeLevelName: gradeById.get(c.grade_level_id)?.name ?? c.grade_level_id,
    teachers: (teachersByClass.get(c.id) ?? []).sort((a, b) =>
      a.role.localeCompare(b.role),
    ),
    deletable: deletableByClassId.get(c.id) ?? false,
  }));

  return {
    ok: true,
    schoolYears,
    gradeLevels,
    classes,
    teachers,
  };
}
