import "server-only";

import { cache } from "react";

import {
  mapGradebookAssignmentsForCalc,
  mapGradebookCategoriesForCalc,
} from "@/features/teacher/gradebook/gradebook-calc-mappers";
import { buildScoreMap } from "@/features/teacher/gradebook/gradebook-utils";
import { loadGradebookPageData } from "@/features/teacher/gradebook/load-gradebook-data";
import { computeStudentReportReadiness } from "@/features/teacher/gradebook/report-readiness";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadSupportFlagsForRoster } from "@/features/attendance-behavior/load-support-flag-data";

import {
  computeAcademicFlags,
  hasAcademicRisk,
  hasEnrichmentCandidate,
  hasMissingWorkAlert,
} from "./academic-flags";
import { mergeSupportFlags } from "./support-flags";
import {
  countInterventionDashboardFilter,
  type InterventionDashboardFilter,
} from "./intervention-dashboard-filters";
import {
  type InterventionSeverity,
  type InterventionStatus,
  type InterventionType,
  interventionSeverities,
  interventionStatuses,
  interventionTypes,
} from "./schema";
import type {
  InterventionsDashboardStudentRow,
  InterventionsDashboardSummary,
  StudentInterventionRow,
} from "./types";

type DbInterventionRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year_id: string;
  intervention_type: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  follow_up_date: string | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapIntervention(row: DbInterventionRow): StudentInterventionRow {
  const profile = unwrapOne(row.profiles);
  const parseType = (v: string): InterventionType =>
    interventionTypes.includes(v as InterventionType)
      ? (v as InterventionType)
      : "academic_support";
  const parseStatus = (v: string): InterventionStatus =>
    interventionStatuses.includes(v as InterventionStatus)
      ? (v as InterventionStatus)
      : "active";
  const parseSeverity = (v: string): InterventionSeverity =>
    interventionSeverities.includes(v as InterventionSeverity)
      ? (v as InterventionSeverity)
      : "medium";

  return {
    id: row.id,
    studentId: row.student_id,
    classId: row.class_id,
    schoolYearId: row.school_year_id,
    interventionType: parseType(row.intervention_type),
    status: parseStatus(row.status),
    severity: parseSeverity(row.severity),
    title: row.title,
    description: row.description ?? "",
    createdBy: row.created_by,
    createdByName: profile?.full_name?.trim() || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    followUpDate: row.follow_up_date,
  };
}

const ACTIVE_STATUSES = new Set<InterventionStatus>(["active", "monitoring", "escalated"]);

async function loadInterventionsForClassIds(
  classIds: string[],
): Promise<Map<string, StudentInterventionRow[]>> {
  const byKey = new Map<string, StudentInterventionRow[]>();
  if (!isSupabaseConfigured() || classIds.length === 0) return byKey;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("student_interventions")
    .select(
      `
      id,
      student_id,
      class_id,
      school_year_id,
      intervention_type,
      status,
      severity,
      title,
      description,
      created_by,
      created_at,
      updated_at,
      resolved_at,
      follow_up_date,
      profiles:created_by ( full_name )
    `,
    )
    .in("class_id", classIds)
    .order("updated_at", { ascending: false });

  if (error) return byKey;

  for (const raw of (data ?? []) as DbInterventionRow[]) {
    const row = mapIntervention(raw);
    const key = `${row.studentId}:${row.classId}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  return byKey;
}

function pickActiveIntervention(
  list: StudentInterventionRow[],
): StudentInterventionRow | null {
  return (
    list.find((i) => ACTIVE_STATUSES.has(i.status)) ??
    list[0] ??
    null
  );
}

function buildSummary(rows: InterventionsDashboardStudentRow[]): InterventionsDashboardSummary {
  const flaggedStudentIds = new Set<string>();
  let missingWorkAlerts = 0;
  let academicRiskAlerts = 0;
  let enrichmentCandidates = 0;
  let activeInterventions = 0;

  for (const row of rows) {
    if (hasAcademicRisk(row.flags) || hasMissingWorkAlert(row.flags)) {
      flaggedStudentIds.add(row.studentId);
    }
    if (hasMissingWorkAlert(row.flags)) missingWorkAlerts += 1;
    if (hasAcademicRisk(row.flags)) academicRiskAlerts += 1;
    if (hasEnrichmentCandidate(row.flags)) enrichmentCandidates += 1;
    if (row.activeIntervention && ACTIVE_STATUSES.has(row.activeIntervention.status)) {
      activeInterventions += 1;
    }
  }

  return {
    activeInterventions,
    studentsFlagged: flaggedStudentIds.size,
    missingWorkAlerts,
    academicRiskAlerts,
    enrichmentCandidates,
  };
}

export type InterventionsDashboardPageData =
  | {
      ok: true;
      classes: { id: string; label: string; gradeName: string }[];
      classId: string | null;
      rows: InterventionsDashboardStudentRow[];
      summary: InterventionsDashboardSummary;
    }
  | { ok: false; message: string };

export const loadInterventionsDashboardPicker = cache(async () => {
  const ws = await loadTeacherWorkspaceData();
  if (!ws.ok) return ws;
  const classes = ws.classes
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      label: [c.name, c.section, c.gradeName].filter(Boolean).join(" · "),
      gradeName: c.gradeName,
      schoolYearLabel: c.schoolYearLabel,
    }));
  return { ok: true as const, classes, roster: ws.roster };
});

export async function loadInterventionsDashboardPageData(args: {
  classId: string | null;
}): Promise<InterventionsDashboardPageData> {
  const picker = await loadInterventionsDashboardPicker();
  if (!picker.ok) return picker;

  const roster = args.classId
    ? picker.roster.filter((r) => r.classId === args.classId)
    : picker.roster;

  if (args.classId && !picker.classes.some((c) => c.id === args.classId)) {
    return { ok: false, message: "You are not assigned to this class." };
  }

  const classIds = [
    ...new Set(
      roster.map((r) => r.classId).filter((id) => !args.classId || id === args.classId),
    ),
  ];

  const interventionsByKey = await loadInterventionsForClassIds(classIds);

  const schoolYearByClass = new Map(
    picker.classes.map((c) => [c.id, c.schoolYearLabel]),
  );
  const supportFlagKeys = roster.map((r) => ({
    studentId: r.studentId,
    classId: r.classId,
    schoolYearLabel: schoolYearByClass.get(r.classId) ?? "",
    termStart: "",
    termEnd: "",
  }));
  const supportFlagsByKey = await loadSupportFlagsForRoster(supportFlagKeys);

  const gradebookByClass = new Map<
    string,
    Awaited<ReturnType<typeof loadGradebookPageData>>
  >();
  await Promise.all(
    classIds.map(async (classId) => {
      const gb = await loadGradebookPageData(classId);
      gradebookByClass.set(classId, gb);
    }),
  );

  const rows: InterventionsDashboardStudentRow[] = [];

  for (const r of roster) {
    const gb = gradebookByClass.get(r.classId);
    if (!gb || !gb.ok) {
      const key = `${r.studentId}:${r.classId}`;
      const supportFlags = supportFlagsByKey.get(key) ?? [];
      const interventions = interventionsByKey.get(key) ?? [];
      const active = pickActiveIntervention(interventions);
      rows.push({
        studentId: r.studentId,
        displayName: r.displayName,
        classId: r.classId,
        classLabel: r.classLabel,
        gradeName: r.gradeName,
        overallPercent: null,
        overallLetter: null,
        isPartialGrade: false,
        missingAssignmentCount: 0,
        flags: supportFlags,
        activeIntervention: active,
        interventionCount: interventions.length,
        lastUpdate: active?.updatedAt ?? null,
        status: active?.status ?? "none",
      });
      continue;
    }

    const ctx = gb.reportReadinessByStudent[r.studentId] ?? {
      transitionNoteStatus: "missing" as const,
      reportCardFinalTerms: [],
    };
    const assignmentsForCalc = mapGradebookAssignmentsForCalc(gb.assignments);
    const categoriesForCalc = mapGradebookCategoriesForCalc(gb.categories);
    const scoreMap = buildScoreMap(
      gb.scores.filter((s) => s.studentId === r.studentId),
    );
    const readiness = computeStudentReportReadiness({
      studentId: r.studentId,
      categories: gb.categories,
      assignments: gb.assignments,
      assignmentsForCalc,
      categoriesForCalc,
      scoresByAssignmentId: scoreMap,
      termFilter: "",
      context: ctx,
    });

    const academicFlags = computeAcademicFlags({
      overallPercent: readiness.overallPercent,
      missingAssignmentCount: readiness.missingAssignmentCount,
    });

    const key = `${r.studentId}:${r.classId}`;
    const supportFlags = supportFlagsByKey.get(key) ?? [];
    const flags = mergeSupportFlags(academicFlags, supportFlags);
    const interventions = interventionsByKey.get(key) ?? [];
    const active = pickActiveIntervention(interventions);

    rows.push({
      studentId: r.studentId,
      displayName: r.displayName,
      classId: r.classId,
      classLabel: r.classLabel,
      gradeName: r.gradeName,
      overallPercent: readiness.overallPercent,
      overallLetter: readiness.overallLetter,
      isPartialGrade: readiness.isPartialGrade,
      missingAssignmentCount: readiness.missingAssignmentCount,
      flags,
      activeIntervention: active,
      interventionCount: interventions.length,
      lastUpdate: active?.updatedAt ?? null,
      status: active?.status ?? "none",
    });
  }

  rows.sort((a, b) => {
    const byClass = a.classLabel.localeCompare(b.classLabel);
    if (byClass !== 0) return byClass;
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });

  return {
    ok: true,
    classes: picker.classes,
    classId: args.classId,
    rows,
    summary: buildSummary(rows),
  };
}

export type TeacherInterventionWidgetMetrics = Record<
  InterventionDashboardFilter,
  number
>;

const EMPTY_WIDGET_METRICS: TeacherInterventionWidgetMetrics = {
  "needs-attention": 0,
  "missing-work": 0,
  "academic-risk": 0,
  "attendance-concern": 0,
  "behavior-concern": 0,
  "positive-recognition": 0,
  "follow-ups-due": 0,
};

/** Counts aligned with interventions dashboard rows and summary helpers. */
export const loadTeacherInterventionWidgetMetrics = cache(
  async (): Promise<TeacherInterventionWidgetMetrics> => {
    const data = await loadInterventionsDashboardPageData({ classId: null });
    if (!data.ok) return EMPTY_WIDGET_METRICS;

    return {
      "needs-attention": countInterventionDashboardFilter(
        data.rows,
        "needs-attention",
      ),
      "missing-work": data.summary.missingWorkAlerts,
      "academic-risk": data.summary.academicRiskAlerts,
      "attendance-concern": countInterventionDashboardFilter(
        data.rows,
        "attendance-concern",
      ),
      "behavior-concern": countInterventionDashboardFilter(
        data.rows,
        "behavior-concern",
      ),
      "positive-recognition": countInterventionDashboardFilter(
        data.rows,
        "positive-recognition",
      ),
      "follow-ups-due": countInterventionDashboardFilter(
        data.rows,
        "follow-ups-due",
      ),
    };
  },
);

