import "server-only";

import { cache } from "react";

import {
  formatAssignmentRole,
  formatClassTitle,
} from "@/features/teacher/dashboard/teacher-home-summaries";
import { getUser } from "@/lib/auth/session";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";

import { classIsCurrentSchoolYear, formatClassWorkspaceMeta } from "./class-workspace-copy";

type SchoolYearEmbed = { id?: string; label: string } | null;
type GradeEmbed = { name: string } | null;
type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  is_active: boolean;
  school_year_id?: string | null;
  school_years: SchoolYearEmbed | SchoolYearEmbed[] | null;
  grade_levels: GradeEmbed | GradeEmbed[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function classYearId(klass: ClassEmbed): string | null {
  const fromColumn = klass.school_year_id?.trim();
  if (fromColumn) return fromColumn;
  return unwrapOne(klass.school_years)?.id?.trim() || null;
}

export type TeacherClassContext = {
  id: string;
  title: string;
  gradeName: string;
  assignmentRole: string;
  roleLabel: string;
  studentCount: number;
  meta: string;
  schoolYearId: string | null;
  schoolYearLabel: string;
  isCurrentYear: boolean;
  isActive: boolean;
};

export type TeacherClassContextResult =
  | { ok: true; context: TeacherClassContext }
  | { ok: false; message: string };

/**
 * Lightweight class shell — assignment check, header metadata, student count.
 * Does not load roster rows, gradebook, report cards, or attendance marks.
 */
export const loadTeacherClassContext = cache(
  async (classId: string): Promise<TeacherClassContextResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (!isUuid(classId)) {
      return { ok: false, message: "This class was not found among your assigned classes." };
    }

    const user = await getUser();
    if (!user?.id) {
      return { ok: false, message: "You need to be signed in to view this class." };
    }

    const supabase = await createServerSupabaseClient();
    const { data: allowed, error: accessError } = await supabase.rpc(
      "teacher_can_access_class",
      { p_class_id: classId },
    );
    if (accessError) {
      logServerError("class-workspace.access", accessError.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (allowed !== true) {
      return { ok: false, message: "This class was not found among your assigned classes." };
    }

    const [classRes, yearRes, countRes, assignmentRes] = await Promise.all([
      supabase
        .from("classes")
        .select(
          `
          id,
          name,
          section,
          is_active,
          school_year_id,
          school_years ( id, label ),
          grade_levels ( name )
        `,
        )
        .eq("id", classId)
        .maybeSingle(),
      loadCurrentSchoolYear(supabase),
      supabase
        .from("student_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("status", "active"),
      supabase
        .from("class_teachers")
        .select("role")
        .eq("class_id", classId)
        .eq("teacher_profile_id", user.id)
        .maybeSingle(),
    ]);

    if (classRes.error) {
      logServerError("class-workspace.loadClass", classRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }
    if (!classRes.data?.id) {
      return { ok: false, message: "This class was not found among your assigned classes." };
    }
    if (!yearRes.ok) {
      return { ok: false, message: yearRes.error };
    }
    if (countRes.error) {
      logServerError("class-workspace.countStudents", countRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const klass = classRes.data as unknown as ClassEmbed;
    const gradeName = unwrapOne(klass.grade_levels)?.name?.trim() || "—";
    const assignmentRole = assignmentRes.data?.role?.trim() || "grade_access";
    const studentCount = countRes.count ?? 0;
    const schoolYearId = classYearId(klass);
    const currentYearId = yearRes.year?.id ?? null;

    return {
      ok: true,
      context: {
        id: klass.id,
        title: formatClassTitle(klass.name, klass.section),
        gradeName,
        assignmentRole,
        roleLabel: formatAssignmentRole(assignmentRole),
        studentCount,
        meta: formatClassWorkspaceMeta({
          gradeName,
          assignmentRole,
          studentCount,
        }),
        schoolYearId,
        schoolYearLabel: unwrapOne(klass.school_years)?.label?.trim() || "",
        isCurrentYear: classIsCurrentSchoolYear(schoolYearId, currentYearId),
        isActive: klass.is_active !== false,
      },
    };
  },
);
