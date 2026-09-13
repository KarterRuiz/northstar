import "server-only";

import { cache } from "react";

import { getProfileRole, getUser } from "@/lib/auth/session";
import {
  OPERATIONAL_ACTIVE_ENROLLMENT_STATUS,
  isOperationallyActiveEnrollment,
} from "@/features/students/active-student-enrollments";
import {
  formatHomeroomDisplay,
  resolveCurrentHomeroom,
  type HomeroomEnrollmentInput,
} from "@/features/students/current-homeroom";
import type { StudentListEntry } from "@/features/students/profile/types";
import { formatStudentNumberDisplay } from "@/features/students/student-number";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StudentDirectoryResult =
  | { ok: true; students: StudentListEntry[] }
  | { ok: false; message: string; students: StudentListEntry[] };

type GradeLevelEmbed = { name: string } | null;
type ClassEmbed = {
  name: string;
  section: string | null;
  is_active?: boolean;
  grade_levels: GradeLevelEmbed | GradeLevelEmbed[] | null;
};
type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  external_id: string | null;
};
type EnrollmentRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year_id: string;
  status: string;
  students: StudentEmbed | StudentEmbed[] | null;
  classes: ClassEmbed | ClassEmbed[] | null;
};

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function gradeLevelName(classes: ClassEmbed | null): string {
  if (!classes) return "—";
  const gl = classes.grade_levels;
  if (!gl) return "—";
  const row = Array.isArray(gl) ? gl[0] : gl;
  return row?.name?.trim() || "—";
}

function classLabel(classes: ClassEmbed | null): string {
  if (!classes) return "—";
  const base = classes.name?.trim() || "Class";
  const sec = classes.section?.trim();
  return sec ? `${base} · ${sec}` : base;
}

function displayName(s: StudentEmbed): string {
  const pref = s.preferred_name?.trim();
  if (pref) return pref;
  return [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "—";
}

function normalizeEnrollmentRow(row: EnrollmentRow): {
  student: StudentEmbed;
  status: string;
  classes: ClassEmbed | null;
} | null {
  const s = row.students;
  const student = Array.isArray(s) ? s[0] : s;
  const c = row.classes;
  const klass = Array.isArray(c) ? c[0] : c;
  if (!student?.id) return null;
  return { student, status: row.status, classes: klass ?? null };
}

/**
 * Operationally active students (≥1 active enrollment in an active class)
 * for the directory table. See active-student-enrollments.ts.
 * Teachers are scoped in-query to `class_teachers` class ids (RLS also applies).
 */
export const loadStudentDirectory = cache(
  async (searchRaw: string | undefined): Promise<StudentDirectoryResult> => {
    if (!isSupabaseConfigured()) {
      return {
        ok: false,
        message: "Supabase is not configured.",
        students: [],
      };
    }

    const supabase = await createServerSupabaseClient();
    const user = await getUser();
    let teacherClassIds: string[] | null = null;
    if (user?.id) {
      const role = await getProfileRole(user.id);
      if (role === "teacher") {
        const { data: ct, error: ctErr } = await supabase
          .from("class_teachers")
          .select("class_id, classes!inner ( is_active )")
          .eq("teacher_profile_id", user.id)
          .eq("classes.is_active", true);
        if (ctErr) {
          return { ok: false, message: ctErr.message, students: [] };
        }
        teacherClassIds = (ct ?? []).map((r) => r.class_id).filter(Boolean);
        if (teacherClassIds.length === 0) {
          return { ok: true, students: [] };
        }
      }
    }

    const q = (searchRaw?.trim() ?? "")
      .replace(/,/g, " ")
      .slice(0, 200);

    let query = supabase
      .from("student_enrollments")
      .select(
        `
        id,
        student_id,
        class_id,
        school_year_id,
        status,
        students!inner (
          id,
          first_name,
          last_name,
          preferred_name,
          external_id
        ),
        classes!inner (
          name,
          section,
          is_active,
          grade_levels ( name )
        )
      `,
      )
      .eq("status", OPERATIONAL_ACTIVE_ENROLLMENT_STATUS)
      .eq("classes.is_active", true)
      .limit(2000);

    if (teacherClassIds) {
      query = query.in("class_id", teacherClassIds);
    }

    if (q.length > 0) {
      const esc = escapeIlikePattern(q);
      const pattern = `%${esc}%`;
      query = query.or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},external_id.ilike.${pattern}`,
        { referencedTable: "students" },
      );
    }

    const { data, error } = await query;

    if (error) {
      return {
        ok: false,
        message: error.message,
        students: [],
      };
    }

    const rows = (data ?? []) as unknown as EnrollmentRow[];
    /** Group operational enrollments per student, then resolve current homeroom. */
    const byStudent = new Map<
      string,
      { student: StudentEmbed; enrollments: HomeroomEnrollmentInput[] }
    >();

    for (const raw of rows) {
      const norm = normalizeEnrollmentRow(raw);
      if (!norm) continue;
      const { student, classes } = norm;
      if (
        !isOperationallyActiveEnrollment({
          status: norm.status,
          classIsActive: classes?.is_active !== false,
        })
      ) {
        continue;
      }
      const input: HomeroomEnrollmentInput = {
        id: raw.id,
        classId: raw.class_id,
        schoolYearId: raw.school_year_id,
        status: norm.status,
        classIsActive: classes?.is_active !== false,
        classLabel: classLabel(classes),
        gradeLabel: gradeLevelName(classes),
      };
      const bucket = byStudent.get(student.id);
      if (bucket) {
        bucket.enrollments.push(input);
      } else {
        byStudent.set(student.id, { student, enrollments: [input] });
      }
    }

    const students: StudentListEntry[] = [];
    for (const { student, enrollments } of byStudent.values()) {
      const resolution = resolveCurrentHomeroom(enrollments);
      const classLabelStr = formatHomeroomDisplay(resolution, { forAdmin: true });
      const chosen =
        resolution.kind === "assigned"
          ? resolution.enrollment
          : resolution.kind === "conflict"
            ? resolution.preferred
            : null;
      students.push({
        id: student.id,
        fullName: displayName(student),
        studentNumber: formatStudentNumberDisplay(student.external_id),
        gradeLevel: chosen?.gradeLabel ?? "—",
        classLabel: classLabelStr,
        status: OPERATIONAL_ACTIVE_ENROLLMENT_STATUS,
        homeroomConflict: resolution.conflict,
      });
    }

    students.sort((a, b) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    );

    return { ok: true, students };
  },
);
