import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";

type SchoolYearEmbed = { label: string; starts_on: string } | null;
type GradeEmbed = { name: string } | null;
type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  is_active: boolean;
  school_years: SchoolYearEmbed | SchoolYearEmbed[] | null;
  grade_levels: GradeEmbed | GradeEmbed[] | null;
};

type ClassTeacherRow = {
  class_id: string;
  role: string;
  classes: ClassEmbed | ClassEmbed[] | null;
};

type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  external_id: string | null;
};

type EnrollmentRow = {
  class_id: string;
  student_id: string;
  students: StudentEmbed | StudentEmbed[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function displayName(s: StudentEmbed): string {
  const pref = s.preferred_name?.trim();
  if (pref) return pref;
  return [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "—";
}

function gradeLabel(klass: ClassEmbed | null): string {
  const gl = unwrapOne(klass?.grade_levels ?? null);
  return gl?.name?.trim() || "—";
}

function schoolYearLabel(klass: ClassEmbed | null): string {
  const sy = unwrapOne(klass?.school_years ?? null);
  return sy?.label?.trim() || "—";
}

function summaryClassLabel(c: TeacherAssignedClassSummary): string {
  const sec = c.section?.trim();
  const base = c.name.trim() || "Class";
  return sec ? `${base} · ${sec}` : base;
}

const IN_CHUNK = 120;

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK));
  }
  return out;
}

export type TeacherAssignedClassSummary = {
  id: string;
  name: string;
  section: string | null;
  gradeName: string;
  schoolYearLabel: string;
  isActive: boolean;
  assignmentRole: string;
  studentCount: number;
};

export type TeacherRosterStudent = {
  studentId: string;
  displayName: string;
  externalId: string | null;
  classId: string;
  classLabel: string;
  gradeName: string;
  transitionSubmitted: boolean;
  reportCardFileForYear: boolean;
};

export type TeacherWorkspaceData =
  | {
      ok: true;
      currentSchoolYearLabel: string | null;
      classes: TeacherAssignedClassSummary[];
      /** One row per student per class enrollment (same student in two classes appears twice). */
      roster: TeacherRosterStudent[];
      /** Non-fatal issues (partial data). */
      warnings: string[];
    }
  | { ok: false; message: string };

async function loadLatestSchoolYearLabel(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("school_years")
    .select("label")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.label?.trim()) return null;
  return data.label.trim();
}

/**
 * Teacher workspace: classes from `class_teachers` for the signed-in user,
 * rosters from `student_enrollments` restricted to those class ids (active only).
 * Completion flags use `transition_notes` (submitted) and `report_card_files` (current school year label).
 */
export const loadTeacherWorkspaceData = cache(
  async (): Promise<TeacherWorkspaceData> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase is not configured." };
    }

    const user = await getUser();
    if (!user?.id) {
      return { ok: false, message: "You need to be signed in to view your classes." };
    }

    const supabase = await createServerSupabaseClient();
    const warnings: string[] = [];

    const { data: ctRows, error: ctError } = await supabase
      .from("class_teachers")
      .select(
        `
        class_id,
        role,
        classes!inner (
          id,
          name,
          section,
          is_active,
          school_years ( label, starts_on ),
          grade_levels ( name )
        )
      `,
      )
      .eq("teacher_profile_id", user.id);

    if (ctError) {
      return { ok: false, message: ctError.message };
    }

    const assigned: TeacherAssignedClassSummary[] = [];
    const classIdSet = new Set<string>();

    for (const raw of (ctRows ?? []) as unknown as ClassTeacherRow[]) {
      const klass = unwrapOne(raw.classes ?? null);
      if (!klass?.id || klass.is_active === false) continue;
      classIdSet.add(klass.id);
      assigned.push({
        id: klass.id,
        name: klass.name?.trim() || "Class",
        section: klass.section?.trim() || null,
        gradeName: gradeLabel(klass),
        schoolYearLabel: schoolYearLabel(klass),
        isActive: klass.is_active,
        assignmentRole: raw.role?.trim() || "teacher",
        studentCount: 0,
      });
    }

    assigned.sort((a, b) =>
      summaryClassLabel(a).localeCompare(summaryClassLabel(b), undefined, {
        sensitivity: "base",
      }),
    );

    const classIds = [...classIdSet];
    if (classIds.length === 0) {
      const yearLabel = await loadLatestSchoolYearLabel(supabase);
      return {
        ok: true,
        currentSchoolYearLabel: yearLabel,
        classes: [],
        roster: [],
        warnings,
      };
    }

    const { data: enRows, error: enError } = await supabase
      .from("student_enrollments")
      .select(
        `
        class_id,
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
      .in("class_id", classIds);

    if (enError) {
      return { ok: false, message: enError.message };
    }

    const classMeta = new Map(
      assigned.map((c) => [
        c.id,
        { label: summaryClassLabel(c), grade: c.gradeName },
      ]),
    );

    const roster: TeacherRosterStudent[] = [];
    const counts = new Map<string, number>();

    for (const raw of (enRows ?? []) as unknown as EnrollmentRow[]) {
      const student = unwrapOne(raw.students ?? null);
      if (!student?.id || !classIdSet.has(raw.class_id)) continue;
      const meta = classMeta.get(raw.class_id) ?? { label: "—", grade: "—" };
      counts.set(raw.class_id, (counts.get(raw.class_id) ?? 0) + 1);
      roster.push({
        studentId: student.id,
        displayName: displayName(student),
        externalId: student.external_id?.trim() || null,
        classId: raw.class_id,
        classLabel: meta.label,
        gradeName: meta.grade,
        transitionSubmitted: false,
        reportCardFileForYear: false,
      });
    }

    for (const c of assigned) {
      c.studentCount = counts.get(c.id) ?? 0;
    }

    roster.sort((a, b) => {
      const byClass = a.classLabel.localeCompare(b.classLabel);
      if (byClass !== 0) return byClass;
      return a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: "base",
      });
    });

    const distinctStudentIds = [...new Set(roster.map((r) => r.studentId))];
    const currentSchoolYearLabel = await loadLatestSchoolYearLabel(supabase);

    const submittedByStudent = new Set<string>();
    const reportCardByStudent = new Set<string>();

    for (const part of chunkIds(distinctStudentIds)) {
      if (part.length === 0) continue;
      const tnPromise = supabase
        .from("transition_notes")
        .select("student_id, status")
        .in("student_id", part)
        .eq("status", "submitted");

      const rcPromise = currentSchoolYearLabel
        ? supabase
            .from("report_card_files")
            .select("student_id")
            .in("student_id", part)
            .eq("school_year", currentSchoolYearLabel)
        : Promise.resolve({
            data: [] as { student_id: string }[],
            error: null,
          });

      const [tnRes, rcRes] = await Promise.all([tnPromise, rcPromise]);

      if (tnRes.error) warnings.push(tnRes.error.message);
      else {
        for (const row of tnRes.data ?? []) {
          submittedByStudent.add(row.student_id);
        }
      }

      if (rcRes.error) warnings.push(rcRes.error.message);
      else {
        for (const row of rcRes.data ?? []) {
          reportCardByStudent.add(row.student_id);
        }
      }
    }

    if (!currentSchoolYearLabel) {
      warnings.push(
        "No school year found; report card completion is shown as incomplete until a year exists.",
      );
    }

    for (const row of roster) {
      row.transitionSubmitted = submittedByStudent.has(row.studentId);
      row.reportCardFileForYear = currentSchoolYearLabel
        ? reportCardByStudent.has(row.studentId)
        : false;
    }

    return {
      ok: true,
      currentSchoolYearLabel,
      classes: assigned,
      roster,
      warnings,
    };
  },
);

export type TeacherClassPageData =
  | {
      ok: true;
      classSummary: TeacherAssignedClassSummary;
      students: TeacherRosterStudent[];
      currentSchoolYearLabel: string | null;
      warnings: string[];
    }
  | { ok: false; message: string };

export const loadTeacherClassPageData = cache(
  async (classId: string): Promise<TeacherClassPageData> => {
    const full = await loadTeacherWorkspaceData();
    if (!full.ok) return full;
    const summary = full.classes.find((c) => c.id === classId);
    if (!summary) {
      return {
        ok: false,
        message: "This class was not found among your assigned classes.",
      };
    }
    const students = full.roster.filter((r) => r.classId === classId);
    return {
      ok: true,
      classSummary: summary,
      students,
      currentSchoolYearLabel: full.currentSchoolYearLabel,
      warnings: full.warnings,
    };
  },
);
