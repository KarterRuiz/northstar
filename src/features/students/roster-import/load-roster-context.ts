import "server-only";

import { cache } from "react";

import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  RosterContextClass,
  RosterContextGrade,
  RosterContextStudent,
  RosterImportContext,
} from "./types";

type GradeEmbed = {
  id: string;
  name: string;
  code: string | null;
} | null;

type ClassRow = {
  id: string;
  name: string;
  section: string | null;
  school_year_id: string;
  grade_level_id: string;
  is_active: boolean;
  grade_levels: GradeEmbed | GradeEmbed[];
};

function unwrapGrade(gl: ClassRow["grade_levels"]): GradeEmbed {
  if (!gl) return null;
  return Array.isArray(gl) ? gl[0] ?? null : gl;
}

function classLabel(row: ClassRow): string {
  const g = unwrapGrade(row.grade_levels);
  const grade = g?.name?.trim() || "—";
  const base = row.name?.trim() || "Class";
  const sec = row.section?.trim();
  const klass = sec ? `${base} · ${sec}` : base;
  return `${grade} · ${klass}`;
}

export const loadRosterImportContext = cache(
  async (): Promise<
    { ok: true; context: RosterImportContext } | { ok: false; message: string }
  > => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();

    const currentYearResult = await loadCurrentSchoolYear(supabase);
    if (!currentYearResult.ok) {
      return { ok: false, message: currentYearResult.error };
    }
    const currentYear = currentYearResult.year;

    const [{ data: gradeRows, error: gradeError }, { data: classRows, error: classError }] =
      await Promise.all([
        supabase
          .from("grade_levels")
          // Omit is_archived — requires 20260807120000_grade_levels_archive_and_code_unique.
          .select("id, name, code, sort_order")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("classes")
          .select(
            `
            id,
            name,
            section,
            school_year_id,
            grade_level_id,
            is_active,
            grade_levels ( id, name, code )
          `,
          )
          .limit(1000),
      ]);

    if (gradeError) {
      logServerError("roster-import.loadContext.grades", gradeError.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (classError) {
      logServerError("roster-import.loadContext.classes", classError.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const grades: RosterContextGrade[] = (gradeRows ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      sortOrder: g.sort_order,
      isArchived: false,
    }));

    const classes: RosterContextClass[] = ((classRows ?? []) as unknown as ClassRow[]).map(
      (row) => {
        const g = unwrapGrade(row.grade_levels);
        return {
          id: row.id,
          name: row.name,
          section: row.section,
          schoolYearId: row.school_year_id,
          gradeLevelId: row.grade_level_id,
          gradeName: g?.name?.trim() || "—",
          gradeCode: g?.code ?? null,
          label: classLabel(row),
          isActive: row.is_active !== false,
        };
      },
    );

    const schoolYearId = currentYear?.id ?? null;

    let students: RosterContextStudent[] = [];

    if (schoolYearId) {
      const { data: enrollmentRows, error: enError } = await supabase
        .from("student_enrollments")
        .select(
          `
          id,
          student_id,
          class_id,
          school_year_id,
          status,
          students ( id, first_name, last_name, preferred_name, external_id ),
          classes ( id, name, section, grade_levels ( name ) )
        `,
        )
        .eq("school_year_id", schoolYearId)
        .limit(5000);

      if (enError) {
        logServerError("roster-import.loadContext.enrollments", enError.message);
        return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
      }

      type EnRow = {
        id: string;
        student_id: string;
        class_id: string;
        school_year_id: string;
        status: string;
        students:
          | {
              id: string;
              first_name: string;
              last_name: string;
              preferred_name: string | null;
              external_id: string | null;
            }
          | {
              id: string;
              first_name: string;
              last_name: string;
              preferred_name: string | null;
              external_id: string | null;
            }[]
          | null;
        classes:
          | {
              id: string;
              name: string;
              section: string | null;
              grade_levels: { name: string } | { name: string }[] | null;
            }
          | {
              id: string;
              name: string;
              section: string | null;
              grade_levels: { name: string } | { name: string }[] | null;
            }[]
          | null;
      };

      const byStudent = new Map<string, RosterContextStudent>();

      for (const raw of (enrollmentRows ?? []) as unknown as EnRow[]) {
        const stu = Array.isArray(raw.students) ? raw.students[0] : raw.students;
        if (!stu) continue;
        const klass = Array.isArray(raw.classes) ? raw.classes[0] : raw.classes;
        const gl = klass?.grade_levels;
        const gName = Array.isArray(gl) ? gl[0]?.name : gl?.name;
        const base = klass?.name?.trim() || "Class";
        const sec = klass?.section?.trim();
        const classPart = sec ? `${base} · ${sec}` : base;
        const classLabelStr = `${gName?.trim() || "—"} · ${classPart}`;

        const existing = byStudent.get(stu.id);
        // Prefer active enrollment when multiple exist.
        if (
          existing &&
          existing.enrollmentStatus === "active" &&
          raw.status !== "active"
        ) {
          continue;
        }

        byStudent.set(stu.id, {
          id: stu.id,
          firstName: stu.first_name,
          lastName: stu.last_name,
          preferredName: stu.preferred_name,
          externalId: stu.external_id,
          enrollmentId: raw.id,
          classId: raw.class_id,
          classLabel: classLabelStr,
          enrollmentStatus: raw.status,
          schoolYearId: raw.school_year_id,
        });
      }

      // Also include students with external IDs but no current-year enrollment.
      const { data: allStudents, error: stuError } = await supabase
        .from("students")
        .select("id, first_name, last_name, preferred_name, external_id")
        .not("external_id", "is", null)
        .limit(5000);

      if (stuError) {
        logServerError("roster-import.loadContext.studentsWithIds", stuError.message);
        return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
      }

      for (const s of allStudents ?? []) {
        if (byStudent.has(s.id)) continue;
        byStudent.set(s.id, {
          id: s.id,
          firstName: s.first_name,
          lastName: s.last_name,
          preferredName: s.preferred_name,
          externalId: s.external_id,
          enrollmentId: null,
          classId: null,
          classLabel: null,
          enrollmentStatus: null,
          schoolYearId: null,
        });
      }

      students = [...byStudent.values()];
    } else {
      const { data: allStudents, error: stuError } = await supabase
        .from("students")
        .select("id, first_name, last_name, preferred_name, external_id")
        .limit(5000);

      if (stuError) {
        logServerError("roster-import.loadContext.allStudents", stuError.message);
        return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
      }

      students = (allStudents ?? []).map((s) => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        preferredName: s.preferred_name,
        externalId: s.external_id,
        enrollmentId: null,
        classId: null,
        classLabel: null,
        enrollmentStatus: null,
        schoolYearId: null,
      }));
    }

    return {
      ok: true,
      context: {
        schoolYearId,
        schoolYearLabel: currentYear?.label ?? null,
        classes,
        grades,
        students,
      },
    };
  },
);
