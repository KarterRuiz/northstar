import "server-only";

import { cache } from "react";

import { getProfileRole, getUser } from "@/lib/auth/session";
import type { StudentListEntry } from "@/features/students/profile/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StudentDirectoryResult =
  | { ok: true; students: StudentListEntry[] }
  | { ok: false; message: string; students: StudentListEntry[] };

type GradeLevelEmbed = { name: string } | null;
type ClassEmbed = {
  name: string;
  section: string | null;
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
  student_id: string;
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
 * Active students (≥1 `active` enrollment) for the directory table.
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
        student_id,
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
          grade_levels ( name )
        )
      `,
      )
      .eq("status", "active")
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
    /** One display row per student — pick the lexicographically smallest class label. */
    const best = new Map<string, StudentListEntry>();

    for (const raw of rows) {
      const norm = normalizeEnrollmentRow(raw);
      if (!norm) continue;
      const { student, status, classes } = norm;
      const gl = gradeLevelName(classes);
      const cl = classLabel(classes);
      const entry: StudentListEntry = {
        id: student.id,
        fullName: displayName(student),
        studentNumber: student.external_id?.trim() || "—",
        gradeLevel: gl,
        classLabel: cl,
        status,
      };

      const prev = best.get(student.id);
      if (!prev || entry.classLabel.localeCompare(prev.classLabel) < 0) {
        best.set(student.id, entry);
      }
    }

    const students = Array.from(best.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }),
    );

    return { ok: true, students };
  },
);
