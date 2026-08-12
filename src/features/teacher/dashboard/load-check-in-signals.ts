import "server-only";

import { cache } from "react";

import { loadSupportFlagsForRoster } from "@/features/attendance-behavior/load-support-flag-data";
import {
  computeAcademicFlags,
  hasAcademicRisk,
  hasMissingWorkAlert,
} from "@/features/interventions/academic-flags";
import { isFollowUpActionable } from "@/features/interventions/follow-up-status";
import {
  hasAttendanceConcern,
  hasBehaviorConcern,
  hasPositiveRecognition,
} from "@/features/interventions/support-flags";
import { overallGradeMeta, type ScoreStatus } from "@/features/teacher/gradebook/calculations";
import {
  mapGradebookAssignmentsForCalc,
  mapGradebookCategoriesForCalc,
} from "@/features/teacher/gradebook/gradebook-calc-mappers";
import type {
  GradebookAssignmentRow,
  GradebookCategoryRow,
  GradebookScoreRow,
} from "@/features/teacher/gradebook/load-gradebook-data";
import { buildScoreMap } from "@/features/teacher/gradebook/gradebook-utils";
import { countMissingAssignments } from "@/features/teacher/gradebook/report-readiness";
import {
  logServerError,
} from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  pickCheckInReason,
  type TeacherCheckInReason,
} from "./teacher-home-summaries";

const ACTIVE_INTERVENTION = new Set(["active", "monitoring", "escalated"]);
const IN_CHUNK = 120;

export type CheckInRosterKey = {
  studentId: string;
  classId: string;
  schoolYearLabel: string;
};

export type CheckInSignal = {
  studentId: string;
  classId: string;
  reason: TeacherCheckInReason | null;
  attendanceConcern: boolean;
  missingWork: boolean;
  academicRisk: boolean;
  behaviorConcern: boolean;
  followUpDue: boolean;
  openPlan: boolean;
  positiveRecognition: boolean;
  missingAssignmentCount: number;
};

function flagKey(studentId: string, classId: string): string {
  return `${studentId}:${classId}`;
}

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK));
  }
  return out;
}

/**
 * Canonical check-in signals for a roster of student×class keys.
 * Batches attendance/behavior flags, interventions, and academic flags.
 * Scope is the provided class ids only — never school-wide tables.
 */
export const loadCheckInSignals = cache(async function loadCheckInSignals(
  keys: CheckInRosterKey[],
): Promise<Map<string, CheckInSignal>> {
  const out = new Map<string, CheckInSignal>();
  if (keys.length === 0) return out;

  const classIds = [...new Set(keys.map((key) => key.classId))];

  const [flagsByKey, interventionByKey, academicByKey] = await Promise.all([
    loadSupportFlagsForRoster(
      keys.map((key) => ({
        studentId: key.studentId,
        classId: key.classId,
        schoolYearLabel: key.schoolYearLabel,
        termStart: "",
        termEnd: "",
      })),
    ),
    loadInterventionSignals(classIds),
    loadAcademicSignals(classIds),
  ]);

  for (const key of keys) {
    const mapKey = flagKey(key.studentId, key.classId);
    const flags = flagsByKey.get(mapKey) ?? [];
    const intervention = interventionByKey.get(mapKey) ?? {
      openPlan: false,
      followUpDue: false,
    };
    const academic = academicByKey.get(mapKey) ?? {
      academicRisk: false,
      missingWork: false,
      missingAssignmentCount: 0,
    };

    const attendanceConcern = hasAttendanceConcern(flags);
    const behaviorConcern = hasBehaviorConcern(flags);
    const reason = pickCheckInReason({
      attendanceConcern,
      missingWork: academic.missingWork,
      academicRisk: academic.academicRisk,
      behaviorConcern,
      followUpDue: intervention.followUpDue,
      openPlan: intervention.openPlan,
    });

    out.set(mapKey, {
      studentId: key.studentId,
      classId: key.classId,
      reason,
      attendanceConcern,
      missingWork: academic.missingWork,
      academicRisk: academic.academicRisk,
      behaviorConcern,
      followUpDue: intervention.followUpDue,
      openPlan: intervention.openPlan,
      positiveRecognition: hasPositiveRecognition(flags),
      missingAssignmentCount: academic.missingAssignmentCount,
    });
  }

  return out;
});

export function countPositiveRecognition(
  signals: Iterable<CheckInSignal>,
): number {
  const seen = new Set<string>();
  for (const signal of signals) {
    if (!signal.positiveRecognition) continue;
    seen.add(signal.studentId);
  }
  return seen.size;
}

async function loadInterventionSignals(
  classIds: string[],
): Promise<Map<string, { openPlan: boolean; followUpDue: boolean }>> {
  const byKey = new Map<string, { openPlan: boolean; followUpDue: boolean }>();
  if (!isSupabaseConfigured() || classIds.length === 0) return byKey;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("student_interventions")
    .select("student_id, class_id, status, follow_up_date")
    .in("class_id", classIds)
    .in("status", ["active", "monitoring", "escalated"]);

  if (error) {
    logServerError("check-in.loadInterventions", error.message);
    return byKey;
  }

  for (const row of data ?? []) {
    if (!ACTIVE_INTERVENTION.has(row.status)) continue;
    const key = flagKey(row.student_id, row.class_id);
    const prev = byKey.get(key) ?? { openPlan: false, followUpDue: false };
    prev.openPlan = true;
    if (isFollowUpActionable(row.follow_up_date)) prev.followUpDue = true;
    byKey.set(key, prev);
  }

  return byKey;
}

type AcademicSignal = {
  academicRisk: boolean;
  missingWork: boolean;
  missingAssignmentCount: number;
};

async function loadAcademicSignals(
  classIds: string[],
): Promise<Map<string, AcademicSignal>> {
  const out = new Map<string, AcademicSignal>();
  if (!isSupabaseConfigured() || classIds.length === 0) return out;

  const supabase = await createServerSupabaseClient();
  const [catRes, assignRes, enrollRes] = await Promise.all([
    supabase
      .from("gradebook_categories")
      .select("id, class_id, name, weight_percent, sort_order")
      .in("class_id", classIds),
    supabase
      .from("gradebook_assignments")
      .select("id, class_id, category_id, title, points_possible, term, created_at")
      .in("class_id", classIds),
    supabase
      .from("student_enrollments")
      .select("class_id, student_id")
      .eq("status", "active")
      .in("class_id", classIds),
  ]);

  if (catRes.error) {
    logServerError("check-in.loadCategories", catRes.error.message);
    return out;
  }
  if (assignRes.error) {
    logServerError("check-in.loadAssignments", assignRes.error.message);
    return out;
  }
  if (enrollRes.error) {
    logServerError("check-in.loadEnrollments", enrollRes.error.message);
    return out;
  }

  const assignmentClass = new Map<string, string>();
  const assignmentsByClass = new Map<string, GradebookAssignmentRow[]>();
  for (const row of assignRes.data ?? []) {
    assignmentClass.set(row.id, row.class_id);
    const list = assignmentsByClass.get(row.class_id) ?? [];
    list.push({
      id: row.id,
      categoryId: row.category_id,
      title: row.title,
      description: null,
      pointsPossible: Number(row.points_possible),
      dueDate: null,
      term: row.term,
      createdAt: row.created_at,
    });
    assignmentsByClass.set(row.class_id, list);
  }

  const categoriesByClass = new Map<string, GradebookCategoryRow[]>();
  for (const row of catRes.data ?? []) {
    const list = categoriesByClass.get(row.class_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      weightPercent: Number(row.weight_percent),
      sortOrder: row.sort_order,
    });
    categoriesByClass.set(row.class_id, list);
  }

  const studentsByClass = new Map<string, string[]>();
  for (const row of enrollRes.data ?? []) {
    if (!row.class_id || !row.student_id) continue;
    const list = studentsByClass.get(row.class_id) ?? [];
    list.push(row.student_id);
    studentsByClass.set(row.class_id, list);
  }

  const assignmentIds = [...assignmentClass.keys()];
  const scoresByClass = new Map<string, GradebookScoreRow[]>();

  if (assignmentIds.length > 0) {
    for (const part of chunkIds(assignmentIds)) {
      const { data, error } = await supabase
        .from("gradebook_scores")
        .select("id, assignment_id, student_id, points_earned, status")
        .in("assignment_id", part);

      if (error) {
        logServerError("check-in.loadScores", error.message);
        continue;
      }

      for (const row of data ?? []) {
        const classId = assignmentClass.get(row.assignment_id);
        if (!classId) continue;
        const list = scoresByClass.get(classId) ?? [];
        list.push({
          id: row.id,
          assignmentId: row.assignment_id,
          studentId: row.student_id,
          pointsEarned: row.points_earned,
          status: row.status as ScoreStatus,
          feedback: null,
        });
        scoresByClass.set(classId, list);
      }
    }
  }

  for (const classId of classIds) {
    const categories = categoriesByClass.get(classId) ?? [];
    const assignments = assignmentsByClass.get(classId) ?? [];
    const studentIds = studentsByClass.get(classId) ?? [];
    if (studentIds.length === 0 || assignments.length === 0) continue;

    const assignmentsForCalc = mapGradebookAssignmentsForCalc(assignments);
    const categoriesForCalc = mapGradebookCategoriesForCalc(categories);
    const scoreMap = buildScoreMap(scoresByClass.get(classId) ?? []);

    for (const studentId of studentIds) {
      const overall = overallGradeMeta({
        categories: categoriesForCalc,
        assignments: assignmentsForCalc,
        scoresByAssignmentId: scoreMap,
        studentId,
        termFilter: null,
      });
      const missingAssignmentCount = countMissingAssignments({
        assignments,
        scoresByAssignmentId: scoreMap,
        studentId,
        termFilter: "",
      });
      const flags = computeAcademicFlags({
        overallPercent: overall.percent,
        missingAssignmentCount,
      });
      out.set(flagKey(studentId, classId), {
        academicRisk: hasAcademicRisk(flags),
        missingWork: hasMissingWorkAlert(flags),
        missingAssignmentCount,
      });
    }
  }

  return out;
}
