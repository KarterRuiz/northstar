import "server-only";

import { cache } from "react";

import {
  countPositiveRecognition,
  loadCheckInSignals,
} from "@/features/teacher/dashboard/load-check-in-signals";
import {
  checkInDetailLabel,
  rankCheckInStudents,
  type TeacherCheckInReason,
} from "@/features/teacher/dashboard/teacher-home-summaries";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  checkInCategoriesFromFlags,
  checkInCategoryForReason,
  type ClassSupportCategory,
} from "./class-support";
import { teacherStudentDisplayName } from "./class-roster";
import { classWorkspaceStudentInterventionsHref } from "./constants";
import { loadTeacherClassContext } from "./load-teacher-class-context";

type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type ClassSupportStudent = {
  studentId: string;
  displayName: string;
  reason: TeacherCheckInReason;
  detail: string;
  category: ClassSupportCategory;
  categories: ClassSupportCategory[];
  href: string;
};

export type TeacherClassSupportData =
  | {
      ok: true;
      students: ClassSupportStudent[];
      positiveNoteCount: number;
    }
  | { ok: false; message: string };

/**
 * Full class Support list — every enrolled student in THIS class who needs
 * a check-in. Same signals as Teacher Home / Overview / roster.
 */
export const loadTeacherClassSupport = cache(
  async (classId: string): Promise<TeacherClassSupportData> => {
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
          preferred_name
        )
      `,
      )
      .eq("status", "active")
      .eq("class_id", classId);

    if (enError) {
      logServerError("class-support.loadEnrollments", enError.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const enrolled: { studentId: string; displayName: string }[] = [];
    for (const raw of enRows ?? []) {
      const student = unwrapOne(
        (raw as { students: StudentEmbed | StudentEmbed[] | null }).students,
      );
      if (!student?.id) continue;
      enrolled.push({
        studentId: student.id,
        displayName: teacherStudentDisplayName({
          preferredName: student.preferred_name,
          firstName: student.first_name ?? "",
          lastName: student.last_name ?? "",
        }),
      });
    }

    if (enrolled.length === 0) {
      return { ok: true, students: [], positiveNoteCount: 0 };
    }

    const yearLabel = ctx.context.schoolYearLabel;
    const signals = await loadCheckInSignals(
      enrolled.map((row) => ({
        studentId: row.studentId,
        classId,
        schoolYearLabel: yearLabel,
      })),
    );

    const nameById = new Map(enrolled.map((row) => [row.studentId, row.displayName]));
    const candidates: ClassSupportStudent[] = [];

    for (const row of enrolled) {
      const signal = signals.get(`${row.studentId}:${classId}`);
      if (!signal?.reason) continue;
      const categories = checkInCategoriesFromFlags(signal);
      candidates.push({
        studentId: row.studentId,
        displayName: nameById.get(row.studentId) ?? "Student",
        reason: signal.reason,
        detail: checkInDetailLabel({
          reason: signal.reason,
          missingAssignmentCount: signal.missingAssignmentCount,
        }),
        category: checkInCategoryForReason(signal.reason),
        categories,
        href: classWorkspaceStudentInterventionsHref(row.studentId),
      });
    }

    const students = rankCheckInStudents(candidates, candidates.length);
    return {
      ok: true,
      students,
      positiveNoteCount: countPositiveRecognition(signals.values()),
    };
  },
);
