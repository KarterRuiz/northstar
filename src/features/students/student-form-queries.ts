import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStudentId } from "@/lib/students/uuid";

export type StudentClassOption = {
  id: string;
  schoolYearId: string;
  label: string;
};

type GradeLevelsEmbed = { name: string } | { name: string }[] | null;
type SchoolYearEmbed =
  | { id: string; label: string; starts_on: string }
  | { id: string; label: string; starts_on: string }[]
  | null;

type ClassRow = {
  id: string;
  school_year_id: string;
  name: string;
  section: string | null;
  grade_levels: GradeLevelsEmbed;
  school_years: SchoolYearEmbed;
};

function gradeLabel(gl: GradeLevelsEmbed): string {
  if (!gl) return "—";
  const row = Array.isArray(gl) ? gl[0] : gl;
  return row?.name?.trim() || "—";
}

function schoolYearLabel(sy: SchoolYearEmbed): string {
  if (!sy) return "—";
  const row = Array.isArray(sy) ? sy[0] : sy;
  return row?.label?.trim() || "—";
}

function schoolYearStartsOn(sy: SchoolYearEmbed): string {
  if (!sy) return "";
  const row = Array.isArray(sy) ? sy[0] : sy;
  return row?.starts_on ?? "";
}

function classOptionLabel(row: ClassRow): string {
  const grade = gradeLabel(row.grade_levels);
  const base = row.name?.trim() || "Class";
  const sec = row.section?.trim();
  const klass = sec ? `${base} · ${sec}` : base;
  const year = schoolYearLabel(row.school_years);
  return `${grade} · ${klass} · ${year}`;
}

export const loadStudentFormClassOptions = cache(
  async (): Promise<
    | { ok: true; classes: StudentClassOption[]; currentSchoolYearId: string | null }
    | { ok: false; message: string }
  > => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();
    const { data: yearRows, error: yearError } = await supabase
      .from("school_years")
      .select("id")
      .order("starts_on", { ascending: false })
      .limit(1);

    if (yearError) {
      return { ok: false, message: yearError.message };
    }

    const currentSchoolYearId = yearRows?.[0]?.id ?? null;

    const { data, error } = await supabase
      .from("classes")
      .select(
        `
        id,
        school_year_id,
        name,
        section,
        grade_levels ( name ),
        school_years ( id, label, starts_on )
      `,
      )
      .eq("is_active", true)
      .limit(500);

    if (error) {
      return { ok: false, message: error.message };
    }

    const rows = (data ?? []) as unknown as ClassRow[];
    const sorted = [...rows].sort((a, b) => {
      const yb = schoolYearStartsOn(b.school_years).localeCompare(
        schoolYearStartsOn(a.school_years),
      );
      if (yb !== 0) return yb;
      const ga = gradeLabel(a.grade_levels);
      const gb = gradeLabel(b.grade_levels);
      const g = ga.localeCompare(gb, undefined, { sensitivity: "base" });
      if (g !== 0) return g;
      return classOptionLabel(a).localeCompare(classOptionLabel(b), undefined, {
        sensitivity: "base",
      });
    });

    const classes: StudentClassOption[] = sorted.map((row) => ({
      id: row.id,
      schoolYearId: row.school_year_id,
      label: classOptionLabel(row),
    }));

    return { ok: true, classes, currentSchoolYearId };
  },
);

export type StudentEnrollmentChoice = {
  id: string;
  classId: string;
  schoolYearId: string;
  status: string;
  label: string;
};

export type StudentEditFormModel =
  | {
      ok: true;
      studentId: string;
      firstName: string;
      lastName: string;
      preferredName: string;
      externalId: string;
      currentSchoolYearId: string | null;
      enrollmentChoices: StudentEnrollmentChoice[];
    }
  | { ok: false; kind: "not_found" | "error"; message?: string };

export const loadStudentEditFormModel = cache(
  async (studentId: string): Promise<StudentEditFormModel> => {
    if (!isStudentId(studentId)) {
      return { ok: false, kind: "error", message: "Invalid student id." };
    }
    if (!isSupabaseConfigured()) {
      return { ok: false, kind: "error", message: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();

    const { data: yearRows, error: yearError } = await supabase
      .from("school_years")
      .select("id")
      .order("starts_on", { ascending: false })
      .limit(1);

    if (yearError) {
      return { ok: false, kind: "error", message: yearError.message };
    }

    const currentSchoolYearId = yearRows?.[0]?.id ?? null;

    const { data, error } = await supabase
      .from("students")
      .select(
        `
        id,
        first_name,
        last_name,
        preferred_name,
        external_id,
        student_enrollments (
          id,
          class_id,
          school_year_id,
          status,
          classes ( id, name, section, grade_levels ( name ) )
        )
      `,
      )
      .eq("id", studentId)
      .maybeSingle();

    if (error) {
      return { ok: false, kind: "error", message: error.message };
    }
    if (!data) {
      return { ok: false, kind: "not_found" };
    }

    type EnEmbed = {
      id: string;
      class_id: string;
      school_year_id: string;
      status: string;
      classes: {
        id: string;
        name: string;
        section: string | null;
        grade_levels: GradeLevelsEmbed;
      } | null;
    };

    type StudentFormRow = {
      id: string;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
      external_id: string | null;
      student_enrollments: EnEmbed | EnEmbed[] | null;
    };

    const row = data as unknown as StudentFormRow;

    const rawEn = row.student_enrollments;
    const list = Array.isArray(rawEn) ? rawEn : rawEn ? [rawEn] : [];

    const enrollmentChoices: StudentEnrollmentChoice[] = list
      .filter((e) => currentSchoolYearId && e.school_year_id === currentSchoolYearId)
      .map((e) => {
        const c = e.classes;
        const klass = c
          ? `${c.name?.trim() || "Class"}${c.section?.trim() ? ` · ${c.section.trim()}` : ""}`
          : "Class";
        const gl = c?.grade_levels;
        const gname = gradeLabel(gl ?? null);
        return {
          id: e.id,
          classId: e.class_id,
          schoolYearId: e.school_year_id,
          status: e.status,
          label: `${gname} · ${klass}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    return {
      ok: true,
      studentId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      preferredName: row.preferred_name?.trim() ?? "",
      externalId: row.external_id?.trim() ?? "",
      currentSchoolYearId,
      enrollmentChoices,
    };
  },
);
