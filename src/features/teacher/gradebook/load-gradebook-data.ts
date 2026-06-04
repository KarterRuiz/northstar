import "server-only";

import { cache } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import { requireTeacherAssignedToClass } from "@/lib/auth/teacher-class-access";
import { isStudentId } from "@/lib/students/uuid";
import type { Database } from "@/types/database.types";

import type { ScoreStatus } from "./calculations";
import type { TransitionNoteStatus } from "./report-readiness";

type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  school_year_id: string;
  school_years: { id: string; label: string } | { id: string; label: string }[] | null;
  grade_levels: { name: string } | { name: string }[] | null;
};

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

function displayName(s: StudentEmbed): string {
  const pref = s.preferred_name?.trim();
  if (pref) return pref;
  return [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "—";
}

export type GradebookCategoryRow = {
  id: string;
  name: string;
  weightPercent: number;
  sortOrder: number;
};

export type GradebookAssignmentRow = {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  pointsPossible: number;
  dueDate: string | null;
  term: string | null;
  /** ISO timestamp from `gradebook_assignments.created_at`. */
  createdAt: string;
};

export type GradebookScoreRow = {
  id: string;
  assignmentId: string;
  studentId: string;
  pointsEarned: number | null;
  status: ScoreStatus;
  feedback: string | null;
};

export type GradebookStudentRow = {
  studentId: string;
  displayName: string;
};

/** Per-student transition note + final report card terms (class school year). */
export type GradebookReportReadinessContext = {
  transitionNoteStatus: TransitionNoteStatus;
  reportCardFinalTerms: string[];
};

export type GradebookReportReadinessByStudent = Record<
  string,
  GradebookReportReadinessContext
>;

export type GradebookPageData =
  | {
      ok: true;
      classId: string;
      className: string;
      classSubtitle: string;
      schoolYearLabel: string;
      reportReadinessByStudent: GradebookReportReadinessByStudent;
      categories: GradebookCategoryRow[];
      assignments: GradebookAssignmentRow[];
      scores: GradebookScoreRow[];
      students: GradebookStudentRow[];
    }
  | { ok: false; message: string };

const IN_CHUNK = 120;

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK));
  }
  return out;
}

function transitionStatusByStudent(
  rows: { student_id: string; status: string }[],
): Map<string, TransitionNoteStatus> {
  const out = new Map<string, TransitionNoteStatus>();
  for (const row of rows) {
    const sid = row.student_id;
    const current = out.get(sid);
    if (row.status === "submitted") {
      out.set(sid, "submitted");
      continue;
    }
    if (current !== "submitted" && current !== "draft") {
      out.set(sid, "draft");
    }
  }
  return out;
}

export const loadReportReadinessByStudent = cache(async function loadReportReadinessByStudent(args: {
  supabase: SupabaseClient<Database>;
  studentIds: string[];
  schoolYearId: string;
  schoolYearLabel: string;
}): Promise<GradebookReportReadinessByStudent> {
  const { supabase, studentIds, schoolYearId, schoolYearLabel } = args;
  const out: GradebookReportReadinessByStudent = {};

  for (const sid of studentIds) {
    out[sid] = { transitionNoteStatus: "missing", reportCardFinalTerms: [] };
  }

  if (studentIds.length === 0) return out;

  const transitionRows: { student_id: string; status: string }[] = [];

  for (const part of chunkIds(studentIds)) {
    const { data, error } = await supabase
      .from("transition_notes")
      .select("student_id, status")
      .eq("school_year_id", schoolYearId)
      .in("student_id", part);

    if (error) continue;
    transitionRows.push(...((data ?? []) as { student_id: string; status: string }[]));
  }

  const finalTermsByStudent = new Map<string, Set<string>>();

  if (schoolYearLabel) {
    for (const part of chunkIds(studentIds)) {
      const { data, error } = await supabase
        .from("report_card_files")
        .select("student_id, term, status")
        .eq("school_year", schoolYearLabel)
        .eq("status", "final")
        .is("voided_at", null)
        .in("student_id", part);

      if (error) continue;

      for (const row of data ?? []) {
        const sid = row.student_id as string;
        const term = String(row.term ?? "").trim();
        if (!(REPORT_CARD_TERMS as readonly string[]).includes(term)) continue;
        let set = finalTermsByStudent.get(sid);
        if (!set) {
          set = new Set();
          finalTermsByStudent.set(sid, set);
        }
        set.add(term);
      }
    }
  }

  const transitionByStudent = transitionStatusByStudent(transitionRows);

  for (const sid of studentIds) {
    out[sid] = {
      transitionNoteStatus: transitionByStudent.get(sid) ?? "missing",
      reportCardFinalTerms: [...(finalTermsByStudent.get(sid) ?? [])].sort(),
    };
  }

  return out;
});

/** Request-scoped dedupe via React cache — safe when layout + page both load gradebook data. */
export const loadGradebookPageData = cache(async function loadGradebookPageData(
  classId: string,
): Promise<GradebookPageData> {
  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { supabase } = gate;

  const { data: klass, error: classError } = await supabase
    .from("classes")
    .select(
      `
      id,
      name,
      section,
      school_year_id,
      school_years ( id, label ),
      grade_levels ( name )
    `,
    )
    .eq("id", classId)
    .maybeSingle();

  if (classError || !klass) {
    return { ok: false, message: classError?.message ?? "Class not found." };
  }

  const c = klass as unknown as ClassEmbed;
  const gradeName = unwrapOne(c.grade_levels)?.name?.trim() || "—";
  const schoolYear = unwrapOne(c.school_years);
  const yearLabel = schoolYear?.label?.trim() || "—";
  const schoolYearId = c.school_year_id ?? schoolYear?.id ?? "";
  const sec = c.section?.trim();
  const classSubtitle = [gradeName, yearLabel, sec ? `Section ${sec}` : null]
    .filter(Boolean)
    .join(" · ");

  const [
    { data: categories, error: catError },
    { data: assignments, error: assignError },
    { data: enrollments, error: enrollError },
  ] = await Promise.all([
    supabase
      .from("gradebook_categories")
      .select("id, name, weight_percent, sort_order")
      .eq("class_id", classId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("gradebook_assignments")
      .select(
        "id, category_id, title, description, points_possible, due_date, term, created_at",
      )
      .eq("class_id", classId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select(
        "student_id, students(id, first_name, last_name, preferred_name)",
      )
      .eq("class_id", classId)
      .eq("status", "active"),
  ]);

  if (catError) return { ok: false, message: catError.message };
  if (assignError) return { ok: false, message: assignError.message };
  if (enrollError) return { ok: false, message: enrollError.message };

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const scores: GradebookScoreRow[] = [];

  if (assignmentIds.length > 0) {
    for (const part of chunkIds(assignmentIds)) {
      const { data: scoreRows, error: scoreError } = await supabase
        .from("gradebook_scores")
        .select("id, assignment_id, student_id, points_earned, status, feedback")
        .in("assignment_id", part);

      if (scoreError) return { ok: false, message: scoreError.message };

      for (const s of scoreRows ?? []) {
        scores.push({
          id: s.id,
          assignmentId: s.assignment_id,
          studentId: s.student_id,
          pointsEarned: s.points_earned,
          status: s.status as ScoreStatus,
          feedback: s.feedback,
        });
      }
    }
  }

  const students: GradebookStudentRow[] = [];
  for (const row of enrollments ?? []) {
    const enrollment = row as unknown as {
      student_id: string;
      students: StudentEmbed | StudentEmbed[] | null;
    };
    const st = unwrapOne(enrollment.students);
    const sid = enrollment.student_id;
    if (!st || !isStudentId(sid)) continue;
    students.push({ studentId: sid, displayName: displayName(st) });
  }
  students.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const studentIds = students.map((s) => s.studentId);
  const reportReadinessByStudent = schoolYearId
    ? await loadReportReadinessByStudent({
        supabase,
        studentIds,
        schoolYearId,
        schoolYearLabel: yearLabel === "—" ? "" : yearLabel,
      })
    : Object.fromEntries(
        studentIds.map((sid) => [
          sid,
          { transitionNoteStatus: "missing" as const, reportCardFinalTerms: [] },
        ]),
      );

  return {
    ok: true,
    classId,
    className: c.name.trim() || "Class",
    classSubtitle,
    schoolYearLabel: yearLabel,
    reportReadinessByStudent,
    categories: (categories ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      weightPercent: Number(row.weight_percent),
      sortOrder: row.sort_order,
    })),
    assignments: (assignments ?? []).map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      pointsPossible: Number(row.points_possible),
      dueDate: row.due_date,
      term: row.term,
      createdAt: row.created_at,
    })),
    scores,
    students,
  };
});
