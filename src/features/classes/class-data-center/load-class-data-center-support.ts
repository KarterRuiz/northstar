import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
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
  checkInCategoriesFromFlags,
  checkInCategoryForReason,
  type ClassSupportCategory,
} from "@/features/teacher/class-workspace/class-support";
import { teacherStudentDisplayName } from "@/features/teacher/class-workspace/class-roster";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { classDataCenterStudentInterventionsHref } from "./constants";
import { loadClassDataCenterContext } from "./load-class-data-center-context";

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

export type ClassDataCenterSupportStudent = {
  studentId: string;
  displayName: string;
  reason: TeacherCheckInReason;
  detail: string;
  category: ClassSupportCategory;
  categories: ClassSupportCategory[];
  href: string;
};

export type ClassDataCenterSupportData =
  | {
      ok: true;
      role: Role;
      students: ClassDataCenterSupportStudent[];
      positiveNoteCount: number;
    }
  | { ok: false; message: string };

export const loadClassDataCenterSupport = cache(
  async (classId: string): Promise<ClassDataCenterSupportData> => {
    const ctx = await loadClassDataCenterContext(classId);
    if (!ctx.ok) return ctx;
    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const { role, schoolYearLabel } = ctx.context;

    const { data: enRows, error: enError } = await supabase
      .from("student_enrollments")
      .select(
        `
        student_id,
        students!inner (
          id, first_name, last_name, preferred_name
        )
      `,
      )
      .eq("status", "active")
      .eq("class_id", classId);

    if (enError) {
      logServerError("class-data-center-support.loadEnrollments", enError.message);
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
      return { ok: true, role, students: [], positiveNoteCount: 0 };
    }

    const signals = await loadCheckInSignals(
      enrolled.map((row) => ({
        studentId: row.studentId,
        classId,
        schoolYearLabel,
      })),
    );

    const nameById = new Map(enrolled.map((row) => [row.studentId, row.displayName]));
    const candidates: ClassDataCenterSupportStudent[] = [];

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
        href: classDataCenterStudentInterventionsHref(role, row.studentId),
      });
    }

    return {
      ok: true,
      role,
      students: rankCheckInStudents(candidates, candidates.length),
      positiveNoteCount: countPositiveRecognition(signals.values()),
    };
  },
);
