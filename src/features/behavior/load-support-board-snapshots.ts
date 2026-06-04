import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  hasAttendanceConcernMetrics,
  tallyAttendanceConcernMetrics,
  type AttendanceConcernRecord,
} from "@/features/attendance/attendance-concerns";
import { attendancePercent, statusCountsInRange } from "@/features/attendance/attendance-metrics";
import {
  formatOverallGrade,
  overallGradeMeta,
  type ScoreStatus,
} from "@/features/teacher/gradebook/calculations";
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
import { currentTermDateRange } from "@/lib/school-term";
import type { Database } from "@/types/database.types";

import type { BehaviorStudentOption } from "./schema";
import { momentPreviewFromRow } from "./support-board-signals";
import {
  emptySupportBoardStudentSnapshot,
  type SupportBoardStudentSnapshot,
} from "./support-board-snapshot-types";

const IN_CHUNK = 120;

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK));
  }
  return out;
}

type ClassYearEmbed = {
  school_years:
    | { label: string; starts_on: string; ends_on: string }
    | { label: string; starts_on: string; ends_on: string }[]
    | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Batch-load grade trend, attendance %, parent contact counts, and last moment per student.
 * Uses the class's school year dates for term + gradebook term filter. Respects RLS via caller's client.
 */
export async function loadSupportBoardSnapshots(args: {
  supabase: SupabaseClient<Database>;
  classId: string;
  students: BehaviorStudentOption[];
}): Promise<Record<string, SupportBoardStudentSnapshot>> {
  const { supabase, classId, students } = args;
  const out: Record<string, SupportBoardStudentSnapshot> = {};
  for (const s of students) {
    out[s.id] = emptySupportBoardStudentSnapshot();
  }

  const studentIds = students.map((s) => s.id);
  if (studentIds.length === 0) return out;

  const { data: klass, error: classErr } = await supabase
    .from("classes")
    .select(
      `
      id,
      school_years ( label, starts_on, ends_on )
    `,
    )
    .eq("id", classId)
    .maybeSingle();

  if (classErr || !klass) return out;

  const sy = unwrapOne((klass as unknown as ClassYearEmbed).school_years);
  const yearLabel = sy?.label?.trim() ?? "";
  const startsOn = sy?.starts_on?.trim() ?? "";
  const endsOn = sy?.ends_on?.trim() ?? "";
  if (!yearLabel || !startsOn || !endsOn) return out;

  const { term, start: termStart, end: termEnd } = currentTermDateRange(startsOn, endsOn);

  const [
    { data: categoriesRaw, error: catError },
    { data: assignmentsRaw, error: assignError },
    { data: attendanceRaw, error: attError },
    { data: parentRaw, error: parentError },
    { data: lastRaw, error: lastError },
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
      .from("attendance_records")
      .select("student_id, class_id, attendance_date, status")
      .eq("class_id", classId)
      .eq("school_year", yearLabel)
      .in("student_id", studentIds)
      .gte("attendance_date", termStart)
      .lte("attendance_date", termEnd),
    supabase
      .from("behavior_records")
      .select("student_id, behavior_date")
      .eq("class_id", classId)
      .eq("school_year", yearLabel)
      .in("student_id", studentIds)
      .gte("behavior_date", termStart)
      .lte("behavior_date", termEnd)
      .or("support_category.eq.parent_communication,behavior_type.eq.parent_contact"),
    supabase
      .from("behavior_records")
      .select(
        "student_id, behavior_date, created_at, generated_summary, title, quick_reason, support_category, behavior_type",
      )
      .eq("class_id", classId)
      .in("student_id", studentIds)
      .order("behavior_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(800, Math.max(120, studentIds.length * 30))),
  ]);

  if (!catError && !assignError) {
    const categories: GradebookCategoryRow[] = (categoriesRaw ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      weightPercent: Number(row.weight_percent),
      sortOrder: row.sort_order,
    }));
    const assignments: GradebookAssignmentRow[] = (assignmentsRaw ?? []).map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      pointsPossible: Number(row.points_possible),
      dueDate: row.due_date,
      term: row.term,
      createdAt: row.created_at,
    }));

    const assignmentIds = assignments.map((a) => a.id);
    const scores: GradebookScoreRow[] = [];
    if (assignmentIds.length > 0) {
      for (const part of chunkIds(assignmentIds)) {
        const { data: scoreRows, error: scoreError } = await supabase
          .from("gradebook_scores")
          .select("id, assignment_id, student_id, points_earned, status, feedback")
          .in("assignment_id", part);

        if (scoreError) break;
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

    const categoriesForCalc = mapGradebookCategoriesForCalc(categories);
    const assignmentsForCalc = mapGradebookAssignmentsForCalc(assignments);
    const scoreMap = buildScoreMap(scores);

    for (const sid of studentIds) {
      const overall = overallGradeMeta({
        categories: categoriesForCalc,
        assignments: assignmentsForCalc,
        scoresByAssignmentId: scoreMap,
        studentId: sid,
        termFilter: term,
      });
      if (overall.percent === null) {
        out[sid] = { ...out[sid]!, gradeLine: null, gradePartial: overall.isPartial };
      } else {
        out[sid] = {
          ...out[sid]!,
          gradeLine: formatOverallGrade(overall, 0),
          gradePartial: overall.isPartial,
        };
      }
    }
  }

  if (!attError && attendanceRaw) {
    const byStudent = new Map<string, AttendanceConcernRecord[]>();
    for (const row of attendanceRaw) {
      const list = byStudent.get(row.student_id) ?? [];
      list.push({ attendanceDate: row.attendance_date, status: row.status });
      byStudent.set(row.student_id, list);
    }
    for (const sid of studentIds) {
      const recs = byStudent.get(sid) ?? [];
      const tally = statusCountsInRange(recs, termStart, termEnd);
      const pct = attendancePercent(tally);
      const metrics = tallyAttendanceConcernMetrics(recs, termStart, termEnd);
      out[sid] = {
        ...out[sid]!,
        attendancePercent: pct,
        attendanceAtRisk: hasAttendanceConcernMetrics(metrics),
        attendanceMarkedDays: tally.marked,
      };
    }
  }

  if (!parentError && parentRaw) {
    const byStudent = new Map<string, { count: number; last: string | null }>();
    for (const row of parentRaw) {
      const cur = byStudent.get(row.student_id) ?? { count: 0, last: null };
      cur.count += 1;
      const d = row.behavior_date;
      if (!cur.last || d > cur.last) cur.last = d;
      byStudent.set(row.student_id, cur);
    }
    for (const sid of studentIds) {
      const cur = byStudent.get(sid);
      out[sid] = {
        ...out[sid]!,
        parentContactsThisTerm: cur?.count ?? 0,
        parentLastBehaviorDate: cur?.last ?? null,
      };
    }
  }

  if (!lastError && lastRaw) {
    const seen = new Set<string>();
    for (const row of lastRaw) {
      const sid = row.student_id as string;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const preview = momentPreviewFromRow({
        generatedSummary: row.generated_summary as string | null,
        title: (row.title as string | null) ?? "",
        quickReason: row.quick_reason as string | null,
      });
      const atIso = (row.created_at as string) || `${row.behavior_date}T12:00:00.000Z`;
      out[sid] = {
        ...out[sid]!,
        lastMoment: preview ? { preview, atIso } : null,
      };
    }
  }

  return out;
}
