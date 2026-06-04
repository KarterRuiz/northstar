import "server-only";

import { cache } from "react";

import {
  mapGradebookAssignmentsForCalc,
  mapGradebookCategoriesForCalc,
} from "@/features/teacher/gradebook/gradebook-calc-mappers";
import { buildScoreMap } from "@/features/teacher/gradebook/gradebook-utils";
import type {
  GradebookAssignmentRow,
  GradebookCategoryRow,
  GradebookScoreRow,
} from "@/features/teacher/gradebook/load-gradebook-data";
import { loadReportReadinessByStudent } from "@/features/teacher/gradebook/load-gradebook-data";
import {
  computeStudentReportReadiness,
  type StudentReportReadiness,
} from "@/features/teacher/gradebook/report-readiness";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type RecentAssignmentRow = {
  id: string;
  title: string;
  categoryName: string;
  dueDate: string | null;
  term: string | null;
  pointsPossible: number;
  scoreLabel: string;
  scoreStatus: "missing" | "scored" | "exempt" | "absent" | "unentered";
};

export type StudentIntelligence = {
  classId: string;
  className: string;
  classSubtitle: string;
  schoolYearLabel: string;
  categories: GradebookCategoryRow[];
  assignments: GradebookAssignmentRow[];
  scores: GradebookScoreRow[];
  readiness: StudentReportReadiness;
  recentAssignments: RecentAssignmentRow[];
  gradebookHref: string | null;
};

export type StudentIntelligenceResult =
  | { kind: "ok"; data: StudentIntelligence }
  | { kind: "no_enrollment" }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  school_year_id: string;
  school_years: { id: string; label: string } | { id: string; label: string }[] | null;
  grade_levels: { name: string } | { name: string }[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function scoreLabelForStudent(
  assignment: GradebookAssignmentRow,
  scores: GradebookScoreRow[],
  studentId: string,
): Pick<RecentAssignmentRow, "scoreLabel" | "scoreStatus"> {
  const score = scores.find(
    (s) => s.assignmentId === assignment.id && s.studentId === studentId,
  );
  if (!score) {
    return { scoreLabel: "Not entered", scoreStatus: "unentered" };
  }
  if (score.status === "missing") {
    return { scoreLabel: "Missing", scoreStatus: "missing" };
  }
  if (score.status === "exempt") {
    return { scoreLabel: "Exempt", scoreStatus: "exempt" };
  }
  if (score.status === "absent") {
    return { scoreLabel: "Absent", scoreStatus: "absent" };
  }
  const earned = score.pointsEarned ?? 0;
  return {
    scoreLabel: `${earned} / ${assignment.pointsPossible}`,
    scoreStatus: "scored",
  };
}

export const loadStudentIntelligence = cache(
  async (
    studentId: string,
    options?: { viewerRole?: string; termFilter?: string },
  ): Promise<StudentIntelligenceResult> => {
    if (!isSupabaseConfigured()) {
      return { kind: "unconfigured" };
    }

    const termFilter = options?.termFilter ?? "";
    const supabase = await createServerSupabaseClient();

    const { data: enrollment, error: enrollError } = await supabase
      .from("student_enrollments")
      .select(
        `
        class_id,
        status,
        classes (
          id,
          name,
          section,
          school_year_id,
          school_years ( id, label ),
          grade_levels ( name )
        )
      `,
      )
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollError) {
      return { kind: "error", message: enrollError.message };
    }
    if (!enrollment?.class_id) {
      return { kind: "no_enrollment" };
    }

    const classId = enrollment.class_id as string;
    const klass = unwrapOne(
      (enrollment as { classes: ClassEmbed | ClassEmbed[] | null }).classes,
    );
    if (!klass) {
      return { kind: "error", message: "Enrollment class could not be loaded." };
    }

    const gradeName = unwrapOne(klass.grade_levels)?.name?.trim() || "—";
    const schoolYear = unwrapOne(klass.school_years);
    const schoolYearLabel = schoolYear?.label?.trim() || "—";
    const schoolYearId = klass.school_year_id ?? schoolYear?.id ?? "";
    const sec = klass.section?.trim();
    const classSubtitle = [gradeName, schoolYearLabel, sec ? `Section ${sec}` : null]
      .filter(Boolean)
      .join(" · ");
    const className = klass.name.trim() || "Class";

    const [
      { data: categories, error: catError },
      { data: assignments, error: assignError },
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
        .order("due_date", { ascending: false, nullsFirst: false })
        .order("title", { ascending: true }),
    ]);

    if (catError) return { kind: "error", message: catError.message };
    if (assignError) return { kind: "error", message: assignError.message };

    const categoryRows: GradebookCategoryRow[] = (categories ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      weightPercent: Number(row.weight_percent),
      sortOrder: row.sort_order,
    }));

    const assignmentRows: GradebookAssignmentRow[] = (assignments ?? []).map(
      (row) => ({
        id: row.id,
        categoryId: row.category_id,
        title: row.title,
        description: row.description,
        pointsPossible: Number(row.points_possible),
        dueDate: row.due_date,
        term: row.term,
        createdAt: row.created_at,
      }),
    );

    const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));

    const assignmentIds = assignmentRows.map((a) => a.id);
    let scores: GradebookScoreRow[] = [];

    if (assignmentIds.length > 0) {
      const { data: scoreRows, error: scoreError } = await supabase
        .from("gradebook_scores")
        .select("id, assignment_id, student_id, points_earned, status, feedback")
        .in("assignment_id", assignmentIds)
        .eq("student_id", studentId);

      if (scoreError) return { kind: "error", message: scoreError.message };

      scores = (scoreRows ?? []).map((s) => ({
        id: s.id,
        assignmentId: s.assignment_id,
        studentId: s.student_id,
        pointsEarned: s.points_earned,
        status: s.status as GradebookScoreRow["status"],
        feedback: s.feedback,
      }));
    }

    const assignmentsForCalc = mapGradebookAssignmentsForCalc(assignmentRows);
    const categoriesForCalc = mapGradebookCategoriesForCalc(categoryRows);
    const scoreMap = buildScoreMap(scores);

    const reportReadinessByStudent = schoolYearId
      ? await loadReportReadinessByStudent({
          supabase,
          studentIds: [studentId],
          schoolYearId,
          schoolYearLabel: schoolYearLabel === "—" ? "" : schoolYearLabel,
        })
      : {
          [studentId]: {
            transitionNoteStatus: "missing" as const,
            reportCardFinalTerms: [],
          },
        };

    const readinessContext = reportReadinessByStudent[studentId] ?? {
      transitionNoteStatus: "missing" as const,
      reportCardFinalTerms: [],
    };

    const readiness = computeStudentReportReadiness({
      studentId,
      categories: categoryRows,
      assignments: assignmentRows,
      assignmentsForCalc,
      categoriesForCalc,
      scoresByAssignmentId: scoreMap,
      termFilter,
      context: readinessContext,
    });

    const recentAssignments: RecentAssignmentRow[] = assignmentRows
      .slice(0, 8)
      .map((a) => {
        const { scoreLabel, scoreStatus } = scoreLabelForStudent(
          a,
          scores,
          studentId,
        );
        return {
          id: a.id,
          title: a.title,
          categoryName: categoryNameById.get(a.categoryId) ?? "—",
          dueDate: a.dueDate,
          term: a.term,
          pointsPossible: a.pointsPossible,
          scoreLabel,
          scoreStatus,
        };
      });

    const gradebookHref =
      options?.viewerRole === "teacher"
        ? `/dashboard/teacher/classes/${classId}/gradebook`
        : null;

    return {
      kind: "ok",
      data: {
        classId,
        className,
        classSubtitle,
        schoolYearLabel,
        categories: categoryRows,
        assignments: assignmentRows,
        scores,
        readiness,
        recentAssignments,
        gradebookHref,
      },
    };
  },
);
