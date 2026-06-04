import "server-only";

import { cache } from "react";

import { loadSchoolYearTermContext } from "@/features/attendance-behavior/load-support-flag-data";
import { BEHAVIOR_CONCERN_TYPES } from "@/features/behavior/schema";
import { BEHAVIOR_CONCERN_THRESHOLD } from "@/features/interventions/support-flags";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { loadSupportBoardSnapshots } from "./load-support-board-snapshots";
import type { BehaviorStudentOption } from "./schema";
import type { BehaviorSeverity, BehaviorType, SupportMomentCategory } from "./schema";
import { behaviorFilterTypes, behaviorSeverities, behaviorTypes } from "./schema";
import type { SupportBoardStudentSnapshot } from "./support-board-snapshot-types";

export type BehaviorLogRow = {
  id: string;
  studentId: string;
  displayName: string;
  classId: string;
  classLabel: string;
  behaviorDate: string;
  behaviorType: BehaviorType;
  supportCategory: SupportMomentCategory | null;
  severity: BehaviorSeverity;
  title: string;
  description: string;
  generatedSummary: string | null;
  teacherNote: string | null;
  supportTags: string[];
  quickReason: string | null;
  followUpRequired: boolean;
  parentContacted: boolean | null;
  timeOfDay: string | null;
  relatedSubject: string | null;
  actionTaken: string | null;
  createdAt: string;
  recordedByName: string | null;
};

export type BehaviorPageData =
  | {
      ok: true;
      classes: { id: string; label: string }[];
      classId: string | null;
      rows: BehaviorLogRow[];
      students: BehaviorStudentOption[];
      viewerDisplayName: string | null;
      /** Present when a single class is selected — batched support-board card context. */
      supportBoardByStudentId?: Record<string, SupportBoardStudentSnapshot>;
    }
  | { ok: false; message: string };

function parseType(value: string): BehaviorType {
  return behaviorTypes.includes(value as BehaviorType)
    ? (value as BehaviorType)
    : "classroom_concern";
}

function parseSeverity(value: string): BehaviorSeverity {
  return behaviorSeverities.includes(value as BehaviorSeverity)
    ? (value as BehaviorSeverity)
    : "low";
}

function parseSupportCategory(value: string | null | undefined): SupportMomentCategory | null {
  if (!value) return null;
  const allowed: SupportMomentCategory[] = [
    "positive_recognition",
    "quick_concern",
    "parent_communication",
    "sel_observation",
    "support_strategy",
    "intervention_followup",
  ];
  return allowed.includes(value as SupportMomentCategory) ? (value as SupportMomentCategory) : null;
}

export const loadBehaviorPageData = cache(async function loadBehaviorPageData(args: {
  classId: string | null;
  studentId: string | null;
  severity: string | null;
  behaviorType: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<BehaviorPageData> {
  const ws = await loadTeacherWorkspaceData();
  if (!ws.ok) return ws;

  const user = await getUser();

  const classes = ws.classes
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      label: [c.name, c.section, c.gradeName].filter(Boolean).join(" · "),
    }));

  const classIds = args.classId
    ? classes.some((c) => c.id === args.classId)
      ? [args.classId]
      : []
    : classes.map((c) => c.id);

  if (classIds.length === 0) {
    return {
      ok: true,
      classes,
      classId: args.classId,
      rows: [],
      students: [],
      viewerDisplayName: null,
      supportBoardByStudentId: undefined,
    };
  }

  const roster = ws.roster.filter((r) => classIds.includes(r.classId));
  const studentMap = new Map<string, BehaviorStudentOption>();
  for (const r of roster) {
    const existing = studentMap.get(r.studentId);
    if (existing) {
      if (!existing.classIds.includes(r.classId)) {
        existing.classIds.push(r.classId);
      }
    } else {
      studentMap.set(r.studentId, {
        id: r.studentId,
        label: r.displayName,
        classIds: [r.classId],
      });
    }
  }
  const students = [...studentMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      classes,
      classId: args.classId,
      rows: [],
      students,
      viewerDisplayName: null,
      supportBoardByStudentId: undefined,
    };
  }

  const supabase = await createServerSupabaseClient();

  let viewerDisplayName: string | null = null;
  if (user?.id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    viewerDisplayName = prof?.full_name?.trim() || null;
  }

  let query = supabase
    .from("behavior_records")
    .select(
      `
      id,
      student_id,
      class_id,
      behavior_date,
      behavior_type,
      support_category,
      severity,
      title,
      description,
      generated_summary,
      teacher_note,
      support_tags,
      quick_reason,
      follow_up_required,
      parent_contacted,
      time_of_day,
      related_subject,
      action_taken,
      created_at,
      recorded_by,
      students ( first_name, last_name, preferred_name )
    `,
    )
    .in("class_id", classIds)
    .order("behavior_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (args.studentId) query = query.eq("student_id", args.studentId);
  if (args.severity && behaviorSeverities.includes(args.severity as BehaviorSeverity)) {
    query = query.eq("severity", args.severity as BehaviorSeverity);
  }
  if (args.behaviorType) {
    if (args.behaviorType === "classroom_concern") {
      query = query.in("behavior_type", ["classroom_concern", "behavior_incident"]);
    } else if (behaviorFilterTypes.includes(args.behaviorType as BehaviorType)) {
      query = query.eq("behavior_type", args.behaviorType as BehaviorType);
    }
  }
  if (args.dateFrom) query = query.gte("behavior_date", args.dateFrom);
  if (args.dateTo) query = query.lte("behavior_date", args.dateTo);

  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };

  const rosterByStudentClass = new Map(
    roster.map((r) => [`${r.studentId}:${r.classId}`, r]),
  );

  type RawRow = {
    id: string;
    student_id: string;
    class_id: string;
    behavior_date: string;
    behavior_type: string;
    support_category: string | null;
    severity: string;
    title: string;
    description: string | null;
    generated_summary: string | null;
    teacher_note: string | null;
    support_tags: string[] | null;
    quick_reason: string | null;
    follow_up_required: boolean | null;
    parent_contacted: boolean | null;
    time_of_day: string | null;
    related_subject: string | null;
    action_taken: string | null;
    created_at: string;
    recorded_by: string;
    students: unknown;
  };

  const rawRows = (data ?? []) as RawRow[];
  const recorderIds = [...new Set(rawRows.map((r) => r.recorded_by))];
  let nameById = new Map<string, string | null>();
  if (recorderIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", recorderIds);
    nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name?.trim() || null]));
  }

  const rows: BehaviorLogRow[] = rawRows.map((raw) => {
    const studentEmbed = Array.isArray(raw.students) ? raw.students[0] : raw.students;
    const rosterRow = rosterByStudentClass.get(`${raw.student_id}:${raw.class_id}`);
    const displayName = rosterRow?.displayName
      ?? (studentEmbed
        ? [studentEmbed.preferred_name, studentEmbed.first_name, studentEmbed.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || "—"
        : "—");

    const recordedByName = nameById.get(raw.recorded_by)?.trim() || null;

    return {
      id: raw.id,
      studentId: raw.student_id,
      displayName,
      classId: raw.class_id,
      classLabel: rosterRow?.classLabel ?? "—",
      behaviorDate: raw.behavior_date,
      behaviorType: parseType(raw.behavior_type),
      supportCategory: parseSupportCategory(raw.support_category),
      severity: parseSeverity(raw.severity),
      title: raw.title,
      description: raw.description ?? "",
      generatedSummary: raw.generated_summary,
      teacherNote: raw.teacher_note,
      supportTags: raw.support_tags ?? [],
      quickReason: raw.quick_reason,
      followUpRequired: Boolean(raw.follow_up_required),
      parentContacted: raw.parent_contacted,
      timeOfDay: raw.time_of_day,
      relatedSubject: raw.related_subject,
      actionTaken: raw.action_taken,
      createdAt: raw.created_at,
      recordedByName,
    };
  });

  let supportBoardByStudentId: Record<string, SupportBoardStudentSnapshot> | undefined;
  if (classIds.length === 1) {
    const onlyClassId = classIds[0]!;
    const rosterForBoard = students.filter((s) => s.classIds.includes(onlyClassId));
    supportBoardByStudentId = await loadSupportBoardSnapshots({
      supabase,
      classId: onlyClassId,
      students: rosterForBoard,
    });
  }

  return {
    ok: true,
    classes,
    classId: args.classId,
    rows,
    students,
    viewerDisplayName,
    supportBoardByStudentId,
  };
});

export type BehaviorConcernStudent = {
  studentId: string;
  displayName: string;
  classId: string;
  classLabel: string;
  concernCount: number;
};

export async function loadBehaviorConcernStudents(): Promise<BehaviorConcernStudent[]> {
  const ws = await loadTeacherWorkspaceData();
  const termCtx = await loadSchoolYearTermContext();
  if (!ws.ok || !termCtx.ok || !isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const classIds = [...new Set(ws.roster.map((r) => r.classId))];
  const studentIds = [...new Set(ws.roster.map((r) => r.studentId))];

  const { data } = await supabase
    .from("behavior_records")
    .select("student_id, class_id, behavior_date, behavior_type, severity")
    .eq("school_year", termCtx.schoolYearLabel)
    .in("class_id", classIds)
    .in("student_id", studentIds)
    .in("behavior_type", BEHAVIOR_CONCERN_TYPES)
    .in("severity", ["medium", "high"])
    .gte("behavior_date", termCtx.termStart)
    .lte("behavior_date", termCtx.termEnd);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = `${row.student_id}:${row.class_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: BehaviorConcernStudent[] = [];
  for (const r of ws.roster) {
    const count = counts.get(`${r.studentId}:${r.classId}`) ?? 0;
    if (count >= BEHAVIOR_CONCERN_THRESHOLD) {
      out.push({
        studentId: r.studentId,
        displayName: r.displayName,
        classId: r.classId,
        classLabel: r.classLabel,
        concernCount: count,
      });
    }
  }

  return out.sort((a, b) => b.concernCount - a.concernCount || a.displayName.localeCompare(b.displayName));
}

export type PositiveRecognitionRow = {
  studentId: string;
  displayName: string;
  classId: string;
  title: string;
  behaviorDate: string;
};

export async function loadRecentPositiveRecognitions(
  limit = 8,
): Promise<PositiveRecognitionRow[]> {
  const ws = await loadTeacherWorkspaceData();
  if (!ws.ok || !isSupabaseConfigured()) return [];

  const classIds = [...new Set(ws.roster.map((r) => r.classId))];
  const supabase = await createServerSupabaseClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);

  const { data } = await supabase
    .from("behavior_records")
    .select("student_id, class_id, title, behavior_date")
    .in("class_id", classIds)
    .eq("behavior_type", "positive_recognition")
    .gte("behavior_date", cutoff.toISOString().slice(0, 10))
    .order("behavior_date", { ascending: false })
    .limit(limit);

  const rosterByKey = new Map(
    ws.roster.map((r) => [`${r.studentId}:${r.classId}`, r]),
  );

  return (data ?? []).map((row) => {
    const rosterRow = rosterByKey.get(`${row.student_id}:${row.class_id}`);
    return {
      studentId: row.student_id,
      displayName: rosterRow?.displayName ?? "Student",
      classId: row.class_id,
      title: row.title,
      behaviorDate: row.behavior_date,
    };
  });
}
