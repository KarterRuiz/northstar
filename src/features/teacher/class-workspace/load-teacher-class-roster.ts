import "server-only";

import { cache } from "react";

import { loadCheckInSignals } from "@/features/teacher/dashboard/load-check-in-signals";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  classRosterHasStudentNumbers,
  classRosterSearchText,
  rosterSupportLabel,
  teacherStudentDisplayName,
} from "./class-roster";
import { classWorkspaceStudentProfileHref } from "./constants";
import { loadTeacherClassContext } from "./load-teacher-class-context";

type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  external_id: string | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type ClassRosterStudent = {
  studentId: string;
  displayName: string;
  studentNumber: string | null;
  searchText: string;
  href: string;
  needsSupport: boolean;
  supportLabel: string;
};

export type TeacherClassRosterData =
  | {
      ok: true;
      students: ClassRosterStudent[];
      showStudentNumber: boolean;
    }
  | { ok: false; message: string };

/**
 * Students-tab roster for one class. Identity + quiet support flag.
 * Report-card / transition completion lives on the Records tab.
 */
export const loadTeacherClassRoster = cache(
  async (classId: string): Promise<TeacherClassRosterData> => {
    const ctx = await loadTeacherClassContext(classId);
    if (!ctx.ok) return ctx;

    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const { data: enRows, error: enError } = await supabase
      .from("student_enrollments")
      .select(
        `
        student_id,
        students!inner (
          id,
          first_name,
          last_name,
          preferred_name,
          external_id
        )
      `,
      )
      .eq("status", "active")
      .eq("class_id", classId);

    if (enError) {
      logServerError("class-roster.loadEnrollments", enError.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    type Draft = {
      studentId: string;
      displayName: string;
      studentNumber: string | null;
      searchText: string;
    };

    const drafts: Draft[] = [];
    for (const raw of enRows ?? []) {
      const student = unwrapOne(
        (raw as { students: StudentEmbed | StudentEmbed[] | null }).students,
      );
      if (!student?.id) continue;
      const firstName = student.first_name ?? "";
      const lastName = student.last_name ?? "";
      const preferredName = student.preferred_name?.trim() || null;
      const studentNumber = student.external_id?.trim() || null;
      const displayName = teacherStudentDisplayName({
        preferredName,
        firstName,
        lastName,
      });
      drafts.push({
        studentId: student.id,
        displayName,
        studentNumber,
        searchText: classRosterSearchText({
          displayName,
          firstName,
          lastName,
          preferredName,
          studentNumber,
        }),
      });
    }

    drafts.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );

    if (drafts.length === 0) {
      return { ok: true, students: [], showStudentNumber: false };
    }

    const studentIds = drafts.map((row) => row.studentId);
    const { schoolYearLabel } = ctx.context;
    const yearRes = await loadCurrentSchoolYear(supabase);
    if (!yearRes.ok) {
      return { ok: false, message: yearRes.error };
    }
    const yearLabel = yearRes.year?.label || schoolYearLabel || "";

    const signalsByKey = await loadCheckInSignals(
      studentIds.map((studentId) => ({
        studentId,
        classId,
        schoolYearLabel: yearLabel,
      })),
    );

    const students: ClassRosterStudent[] = drafts.map((row) => {
      const reason = signalsByKey.get(`${row.studentId}:${classId}`)?.reason ?? null;
      return {
        studentId: row.studentId,
        displayName: row.displayName,
        studentNumber: row.studentNumber,
        searchText: row.searchText,
        href: classWorkspaceStudentProfileHref(row.studentId),
        needsSupport: reason != null,
        supportLabel: rosterSupportLabel(reason),
      };
    });

    return {
      ok: true,
      students,
      showStudentNumber: classRosterHasStudentNumbers(students),
    };
  },
);
