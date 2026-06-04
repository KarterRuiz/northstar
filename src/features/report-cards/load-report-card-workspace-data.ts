import "server-only";

import { cache } from "react";

import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import {
  categoryAveragePercent,
  letterGradeFromPercent,
  type AssignmentForCalc,
  type CategoryForCalc,
} from "@/features/teacher/gradebook/calculations";
import { buildScoreMap } from "@/features/teacher/gradebook/gradebook-utils";
import { tallyAttendanceConcernMetrics } from "@/features/attendance/attendance-concerns";
import {
  attendancePercent,
  statusCountsInRange,
} from "@/features/attendance/attendance-metrics";
import { getAttendanceRiskTier } from "@/features/attendance/attendance-risk-tier";
import { loadStudentBehaviorProfile } from "@/features/attendance-behavior/load-student-behavior-profile";
import {
  loadSchoolYearTermContext,
  loadSupportFlagsForStudent,
} from "@/features/attendance-behavior/load-support-flag-data";
import { behaviorTypeLabels } from "@/features/behavior/schema";
import { loadStudentInterventions } from "@/features/interventions/load-student-interventions";
import { interventionTypeLabels } from "@/features/interventions/schema";
import { loadGradebookPageData } from "@/features/teacher/gradebook/load-gradebook-data";
import { computeStudentReportReadiness } from "@/features/teacher/gradebook/report-readiness";
import { isReportCardTerm, REPORT_CARD_TERMS, type ReportCardTerm } from "@/lib/report-cards/constants";
import { requireTeacherAssignedToClass } from "@/lib/auth/teacher-class-access";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";
import { loadSchoolReportBranding } from "@/features/school-settings/load-school-report-branding";
import type {
  ReportCardAssignmentSummary,
  ReportCardAttendanceSummary,
  ReportCardBehaviorSnapshot,
  ReportCardCategoryAverage,
  ReportCardCommentRow,
  ReportCardInterventionsSnapshot,
  ReportCardPreviewPayload,
  ReportCardWorkspaceStudentRow,
} from "./types";

export type ReportCardWorkspacePageData =
  | {
      ok: true;
      classes: { id: string; label: string; schoolYearLabel: string }[];
      classId: string | null;
      className: string | null;
      classSubtitle: string | null;
      schoolYearId: string | null;
      schoolYearLabel: string | null;
      term: ReportCardTerm;
      students: ReportCardWorkspaceStudentRow[];
    }
  | { ok: false; message: string };

type CommentDbRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year_id: string;
  term: string;
  narrative_comment: string;
  status: string;
  teacher_profile_id: string;
  updated_at: string;
};

function mapCommentRow(row: CommentDbRow): ReportCardCommentRow {
  return {
    id: row.id,
    studentId: row.student_id,
    classId: row.class_id,
    schoolYearId: row.school_year_id,
    term: row.term as ReportCardTerm,
    narrativeComment: row.narrative_comment ?? "",
    status: row.status === "complete" ? "complete" : "draft",
    teacherProfileId: row.teacher_profile_id,
    updatedAt: row.updated_at,
  };
}

async function loadCommentsForClassTerm(args: {
  classId: string;
  schoolYearId: string;
  term: ReportCardTerm;
  studentIds: string[];
}): Promise<Map<string, ReportCardCommentRow>> {
  const map = new Map<string, ReportCardCommentRow>();
  if (!isSupabaseConfigured() || args.studentIds.length === 0) return map;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("report_card_comments")
    .select(
      "id, student_id, class_id, school_year_id, term, narrative_comment, status, teacher_profile_id, updated_at",
    )
    .eq("class_id", args.classId)
    .eq("school_year_id", args.schoolYearId)
    .eq("term", args.term)
    .in("student_id", args.studentIds);

  if (error) return map;

  for (const row of (data ?? []) as CommentDbRow[]) {
    map.set(row.student_id, mapCommentRow(row));
  }
  return map;
}

export const loadReportCardWorkspacePicker = cache(async () => {
  const ws = await loadTeacherWorkspaceData();
  if (!ws.ok) return ws;
  const classes = ws.classes
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      label: [c.name, c.section, c.gradeName].filter(Boolean).join(" · "),
      schoolYearLabel: c.schoolYearLabel,
    }));
  return { ok: true as const, classes };
});

export async function loadReportCardWorkspacePageData(args: {
  classId: string | null;
  term: string;
}): Promise<ReportCardWorkspacePageData> {
  const picker = await loadReportCardWorkspacePicker();
  if (!picker.ok) return picker;

  const term: ReportCardTerm = isReportCardTerm(args.term)
    ? args.term
    : REPORT_CARD_TERMS[0];

  if (!args.classId || !isUuid(args.classId)) {
    return {
      ok: true,
      classes: picker.classes,
      classId: null,
      className: null,
      classSubtitle: null,
      schoolYearId: null,
      schoolYearLabel: null,
      term,
      students: [],
    };
  }

  const classId = args.classId;
  const allowed = picker.classes.some((c) => c.id === classId);
  if (!allowed) {
    return { ok: false, message: "You are not assigned to this class." };
  }

  const gradebook = await loadGradebookPageData(classId);
  if (!gradebook.ok) return gradebook;

  const gate = await requireTeacherAssignedToClass(classId);
  if (!gate.ok) return gate;

  const { data: klass } = await gate.supabase
    .from("classes")
    .select("school_year_id, school_years ( id, label )")
    .eq("id", classId)
    .maybeSingle();

  const schoolYearId =
    (klass as { school_year_id?: string } | null)?.school_year_id ?? "";
  if (!schoolYearId) {
    return { ok: false, message: "Class has no school year." };
  }

  const studentIds = gradebook.students.map((s) => s.studentId);
  const commentsByStudent = await loadCommentsForClassTerm({
    classId,
    schoolYearId,
    term,
    studentIds,
  });

  const assignmentsForCalc: AssignmentForCalc[] = gradebook.assignments.map((a) => ({
    id: a.id,
    categoryId: a.categoryId,
    pointsPossible: a.pointsPossible,
    term: a.term,
  }));
  const categoriesForCalc: CategoryForCalc[] = gradebook.categories.map((c) => ({
    id: c.id,
    weightPercent: c.weightPercent,
  }));

  const students: ReportCardWorkspaceStudentRow[] = gradebook.students.map((st) => {
    const ctx = gradebook.reportReadinessByStudent[st.studentId] ?? {
      transitionNoteStatus: "missing" as const,
      reportCardFinalTerms: [],
    };
    const scoreMap = buildScoreMap(
      gradebook.scores.filter((s) => s.studentId === st.studentId),
    );
    const readiness = computeStudentReportReadiness({
      studentId: st.studentId,
      categories: gradebook.categories,
      assignments: gradebook.assignments,
      assignmentsForCalc,
      categoriesForCalc,
      scoresByAssignmentId: scoreMap,
      termFilter: term,
      context: ctx,
    });

    return {
      studentId: st.studentId,
      displayName: st.displayName,
      readinessStatus: readiness.status,
      overallPercent: readiness.overallPercent,
      overallLetter: readiness.overallLetter,
      isPartialGrade: readiness.isPartialGrade,
      transitionNoteStatus: readiness.transitionNoteStatus,
      missingReportCardTerms: readiness.missingReportCardTerms,
      reportCardFinalTerms: readiness.reportCardFinalTerms,
      comment: commentsByStudent.get(st.studentId) ?? null,
    };
  });

  return {
    ok: true,
    classes: picker.classes,
    classId,
    className: gradebook.className,
    classSubtitle: gradebook.classSubtitle,
    schoolYearId,
    schoolYearLabel: gradebook.schoolYearLabel,
    term,
    students,
  };
}

function buildTransitionSummary(row: {
  academic_strengths: string | null;
  academic_needs: string | null;
  recommended_next_steps: string | null;
  reading_notes?: string | null;
  learning_habits?: string | null;
}): string {
  const parts = [
    row.academic_strengths,
    row.academic_needs,
    row.recommended_next_steps,
    row.reading_notes,
    row.learning_habits,
  ]
    .map((s) => s?.trim())
    .filter(Boolean);
  return parts.join("\n\n") || "";
}

async function loadTermAttendanceSummary(args: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  studentId: string;
  classId: string;
  schoolYearLabel: string;
}): Promise<ReportCardAttendanceSummary | null> {
  if (!args.supabase || !args.schoolYearLabel || args.schoolYearLabel === "—") {
    return null;
  }

  const termCtx = await loadSchoolYearTermContext();
  if (!termCtx.ok) return null;

  const { data, error } = await args.supabase
    .from("attendance_records")
    .select("attendance_date, status")
    .eq("student_id", args.studentId)
    .eq("class_id", args.classId)
    .eq("school_year", args.schoolYearLabel)
    .gte("attendance_date", termCtx.termStart)
    .lte("attendance_date", termCtx.termEnd);

  if (error) return null;

  const rows = (data ?? []).map((r) => ({
    attendanceDate: r.attendance_date as string,
    status: r.status as string,
  }));
  const tally = statusCountsInRange(rows, termCtx.termStart, termCtx.termEnd);
  const metrics = tallyAttendanceConcernMetrics(rows, termCtx.termStart, termCtx.termEnd);
  const riskTier = getAttendanceRiskTier(metrics);

  return {
    termAbsences: tally.absent,
    termTardies: tally.tardy,
    termExcused: tally.excused,
    termPartial: tally.partial,
    termAttendancePct: attendancePercent(tally),
    riskTier,
  };
}

function buildAssignmentSummary(args: {
  assignments: { id: string; term: string | null }[];
  scoresByAssignmentId: Map<string, { status: string }>;
  studentId: string;
  term: string;
  missingCount: number;
}): ReportCardAssignmentSummary {
  const scoped = args.assignments.filter((a) => a.term === args.term);
  let gradedCount = 0;
  for (const a of scoped) {
    const score = args.scoresByAssignmentId.get(`${a.id}:${args.studentId}`);
    if (score && score.status !== "missing") gradedCount += 1;
  }
  return {
    totalInTerm: scoped.length,
    gradedCount,
    missingCount: args.missingCount,
  };
}

function buildBehaviorSnapshot(
  profile: Awaited<ReturnType<typeof loadStudentBehaviorProfile>>,
): ReportCardBehaviorSnapshot {
  if (!profile.ok) {
    return {
      positiveRecognitions: [],
      concerns: [],
      parentContacts: [],
      hasRecords: false,
    };
  }

  const mapLine = (r: { behaviorDate: string; title: string; description: string }) => ({
    date: r.behaviorDate,
    title: r.title,
    description: r.description,
  });

  const parentContacts = profile.growthStoryRecords
    .filter((r) => r.behaviorType === "parent_contact")
    .slice(0, 5)
    .map((r) => ({
      date: r.behaviorDate,
      title: r.title || behaviorTypeLabels.parent_contact,
      description: r.description,
    }));

  return {
    positiveRecognitions: profile.positives.map(mapLine),
    concerns: profile.concerns.map(mapLine),
    parentContacts,
    hasRecords: profile.recent.length > 0,
  };
}

function buildInterventionsSnapshot(args: {
  schoolYearId: string;
  rows: Awaited<ReturnType<typeof loadStudentInterventions>>;
}): ReportCardInterventionsSnapshot {
  if (!args.rows.ok) {
    return { active: [], recentlyResolved: [] };
  }

  const forYear = args.rows.interventions.filter(
    (i) => i.schoolYearId === args.schoolYearId,
  );
  const active = forYear
    .filter((i) => i.status === "active")
    .slice(0, 8)
    .map((i) => ({
      title: i.title,
      status: interventionTypeLabels[i.interventionType] ?? i.interventionType,
      followUpDate: i.followUpDate,
      resolvedAt: null,
    }));

  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentlyResolved = forYear
    .filter((i) => i.status === "resolved" && i.resolvedAt)
    .filter((i) => new Date(i.resolvedAt!).getTime() >= cutoff)
    .slice(0, 5)
    .map((i) => ({
      title: i.title,
      status: "Resolved",
      followUpDate: null,
      resolvedAt: i.resolvedAt,
    }));

  return { active, recentlyResolved };
}

export async function loadReportCardPreviewData(args: {
  classId: string;
  studentId: string;
  term: string;
}): Promise<{ ok: true; data: ReportCardPreviewPayload } | { ok: false; message: string }> {
  if (!isUuid(args.classId) || !isUuid(args.studentId)) {
    return { ok: false, message: "Invalid id." };
  }

  const term: ReportCardTerm = isReportCardTerm(args.term)
    ? args.term
    : REPORT_CARD_TERMS[0];

  const gate = await requireTeacherAssignedToClass(args.classId);
  if (!gate.ok) return gate;

  const gradebook = await loadGradebookPageData(args.classId);
  if (!gradebook.ok) return gradebook;

  const student = gradebook.students.find((s) => s.studentId === args.studentId);
  if (!student) {
    return { ok: false, message: "Student is not on this class roster." };
  }

  const { data: klass } = await gate.supabase
    .from("classes")
    .select(
      `
      school_year_id,
      grade_levels ( name )
    `,
    )
    .eq("id", args.classId)
    .maybeSingle();

  const schoolYearId = (klass as { school_year_id?: string } | null)?.school_year_id;
  if (!schoolYearId) {
    return { ok: false, message: "Class has no school year." };
  }

  const gradeEmbed = (klass as { grade_levels?: { name: string } | { name: string }[] | null })
    ?.grade_levels;
  const gradeLevel =
    (Array.isArray(gradeEmbed) ? gradeEmbed[0]?.name : gradeEmbed?.name)?.trim() || "—";

  const commentsByStudent = await loadCommentsForClassTerm({
    classId: args.classId,
    schoolYearId,
    term,
    studentIds: [args.studentId],
  });

  const assignmentsForCalc: AssignmentForCalc[] = gradebook.assignments.map((a) => ({
    id: a.id,
    categoryId: a.categoryId,
    pointsPossible: a.pointsPossible,
    term: a.term,
  }));
  const categoriesForCalc: CategoryForCalc[] = gradebook.categories.map((c) => ({
    id: c.id,
    weightPercent: c.weightPercent,
  }));

  const ctx = gradebook.reportReadinessByStudent[args.studentId] ?? {
    transitionNoteStatus: "missing" as const,
    reportCardFinalTerms: [],
  };
  const scoreMap = buildScoreMap(
    gradebook.scores.filter((s) => s.studentId === args.studentId),
  );
  const readiness = computeStudentReportReadiness({
    studentId: args.studentId,
    categories: gradebook.categories,
    assignments: gradebook.assignments,
    assignmentsForCalc,
    categoriesForCalc,
    scoresByAssignmentId: scoreMap,
    termFilter: term,
    context: ctx,
  });

  const branding = await loadSchoolReportBranding();

  const categoryAverages: ReportCardCategoryAverage[] = gradebook.categories.map((cat) => {
    const avg = categoryAveragePercent({
      assignments: assignmentsForCalc,
      scoresByAssignmentId: scoreMap,
      studentId: args.studentId,
      categoryId: cat.id,
      termFilter: term,
    });
    return {
      name: cat.name,
      percent: avg,
      letter: avg !== null ? letterGradeFromPercent(avg) : null,
    };
  });

  const assignmentSummary = buildAssignmentSummary({
    assignments: gradebook.assignments,
    scoresByAssignmentId: scoreMap,
    studentId: args.studentId,
    term,
    missingCount: readiness.missingAssignmentCount,
  });

  const termCtx = await loadSchoolYearTermContext();

  const [
    studentNumberResult,
    transitionResult,
    teacherProfileResult,
    behaviorProfile,
    interventionRows,
    attendance,
    supportFlags,
  ] = await Promise.all([
    gate.supabase
      .from("students")
      .select("external_id")
      .eq("id", args.studentId)
      .maybeSingle(),
    gate.supabase
      .from("transition_notes")
      .select(
        "academic_strengths, academic_needs, recommended_next_steps, reading_notes, learning_habits, status",
      )
      .eq("student_id", args.studentId)
      .eq("school_year_id", schoolYearId)
      .eq("status", "submitted")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    gate.supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data: profile } = await gate.supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      return profile?.full_name?.trim() || profile?.email?.trim() || null;
    }),
    loadStudentBehaviorProfile(args.studentId, "teacher"),
    loadStudentInterventions(args.studentId),
    loadTermAttendanceSummary({
      supabase: gate.supabase,
      studentId: args.studentId,
      classId: args.classId,
      schoolYearLabel: gradebook.schoolYearLabel,
    }),
    termCtx.ok
      ? loadSupportFlagsForStudent({
          studentId: args.studentId,
          classId: args.classId,
          schoolYearLabel: gradebook.schoolYearLabel,
          termStart: termCtx.termStart,
          termEnd: termCtx.termEnd,
        })
      : Promise.resolve([]),
  ]);

  const transitionRow = transitionResult.data;
  const transitionSummary =
    transitionRow && transitionRow.status === "submitted"
      ? buildTransitionSummary(transitionRow).trim() || null
      : null;

  const studentNumber =
    studentNumberResult.data?.external_id?.trim() || null;

  const dataCurrentAsOf = new Date().toISOString();

  return {
    ok: true,
    data: {
      classId: args.classId,
      className: gradebook.className,
      classSubtitle: gradebook.classSubtitle,
      gradeLevel,
      schoolYearLabel: gradebook.schoolYearLabel,
      term,
      studentId: args.studentId,
      studentDisplayName: student.displayName,
      studentNumber,
      teacherName: teacherProfileResult,
      readiness,
      comment: commentsByStudent.get(args.studentId) ?? null,
      branding,
      categoryAverages,
      assignmentSummary,
      attendance,
      behavior: buildBehaviorSnapshot(behaviorProfile),
      interventions: buildInterventionsSnapshot({
        schoolYearId,
        rows: interventionRows,
      }),
      supportFlags,
      transitionSummary,
      dataCurrentAsOf,
    },
  };
}
