import "server-only";

import { cache } from "react";

import { loadAdminOverviewGreetingName } from "@/features/admin/dashboard/load-admin-command-center";
import { schoolTodayIso } from "@/features/calendar/school-timezone";
import {
  countCompleteStudents,
  resolveReportingCycle,
  type ReportingFileInput,
} from "@/features/report-cards/reporting-progress";
import {
  classWorkspaceAttendanceHref,
  classWorkspaceStudentInterventionsHref,
} from "@/features/teacher/class-workspace/constants";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { getUser } from "@/lib/auth/session";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  countPositiveRecognition,
  loadCheckInSignals,
} from "./load-check-in-signals";
import {
  attendanceQuickAccessSummary,
  attendanceStatusForClass,
  checkInDetailLabel,
  classBelongsToCurrentYear,
  formatAssignmentRole,
  formatClassTitle,
  rankCheckInStudents,
  reportCardsQuickAccessSummary,
  summarizeTeacherRecords,
  supportQuickAccessSummary,
  TEACHER_HOME_CHECK_IN_LIMIT,
  type TeacherAttendanceStatus,
  type TeacherCheckInReason,
  type TeacherRecordsSummary,
} from "./teacher-home-summaries";

const BASE = "/dashboard/teacher";
const IN_CHUNK = 120;

type SchoolYearEmbed = { id?: string; label: string } | null;
type GradeEmbed = { name: string } | null;
type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  is_active: boolean;
  school_year_id?: string | null;
  school_years: SchoolYearEmbed | SchoolYearEmbed[] | null;
  grade_levels: GradeEmbed | GradeEmbed[] | null;
};
type ClassTeacherRow = {
  role: string;
  classes: ClassEmbed | ClassEmbed[] | null;
};

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, IN_CHUNK + i));
  }
  return out;
}

function classYearId(klass: ClassEmbed): string | null {
  const fromColumn = klass.school_year_id?.trim();
  if (fromColumn) return fromColumn;
  return unwrapOne(klass.school_years)?.id?.trim() || null;
}

export type TeacherHomeClassCard = {
  id: string;
  title: string;
  studentCount: number;
  roleLabel: string;
  attendance: TeacherAttendanceStatus;
  classHref: string;
  attendanceHref: string;
};

export type TeacherHomeCheckInStudent = {
  studentId: string;
  displayName: string;
  reason: TeacherCheckInReason;
  detail: string;
  href: string;
};

export type TeacherHomeQuickAccessId =
  | "classes"
  | "attendance"
  | "students"
  | "gradebook"
  | "report-cards"
  | "support";

export type TeacherHomeQuickAccessCard = {
  id: TeacherHomeQuickAccessId;
  title: string;
  path: string;
  summary: string;
};

export type TeacherHomeData =
  | {
      ok: true;
      classes: TeacherHomeClassCard[];
      checkIn: TeacherHomeCheckInStudent[];
      positiveNoteCount: number;
      records: TeacherRecordsSummary;
      quickAccess: TeacherHomeQuickAccessCard[];
      studentCount: number;
      error: string | null;
    }
  | { ok: false; message: string };

type AssignedClass = {
  id: string;
  name: string;
  section: string | null;
  assignmentRole: string;
  schoolYearId: string | null;
  schoolYearLabel: string;
};

async function loadAssignedClasses(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  currentYearId: string | null,
): Promise<{ classes: AssignedClass[]; error: string | null }> {
  const { data: ctRows, error: ctError } = await supabase
    .from("class_teachers")
    .select(
      `
      role,
      classes!inner (
        id,
        name,
        section,
        is_active,
        school_year_id,
        school_years ( id, label ),
        grade_levels ( name )
      )
    `,
    )
    .eq("teacher_profile_id", userId);

  if (ctError) {
    logServerError("teacher-home.loadClassTeachers", ctError.message);
    return { classes: [], error: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const assigned: AssignedClass[] = [];
  const seen = new Set<string>();
  let hasDirectAssignments = false;

  for (const raw of (ctRows ?? []) as unknown as ClassTeacherRow[]) {
    const klass = unwrapOne(raw.classes ?? null);
    if (!klass?.id || klass.is_active === false) continue;
    hasDirectAssignments = true;
    if (!classBelongsToCurrentYear(classYearId(klass), currentYearId)) continue;
    if (seen.has(klass.id)) continue;
    seen.add(klass.id);
    assigned.push({
      id: klass.id,
      name: klass.name?.trim() || "Class",
      section: klass.section?.trim() || null,
      assignmentRole: raw.role?.trim() || "teacher",
      schoolYearId: classYearId(klass),
      schoolYearLabel: unwrapOne(klass.school_years)?.label?.trim() || "",
    });
  }

  if (!hasDirectAssignments) {
    const { data: gradeRows, error: gradeErr } = await supabase
      .from("staff_grade_levels")
      .select("grade_level_id")
      .eq("profile_id", userId);

    if (gradeErr) {
      logServerError("teacher-home.loadStaffGradeLevels", gradeErr.message);
      return { classes: [], error: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const gradeIds = [...new Set((gradeRows ?? []).map((row) => row.grade_level_id))];
    if (gradeIds.length > 0) {
      let gradeQuery = supabase
        .from("classes")
        .select(
          `
          id,
          name,
          section,
          is_active,
          school_year_id,
          school_years ( id, label ),
          grade_levels ( name )
        `,
        )
        .eq("is_active", true)
        .in("grade_level_id", gradeIds);

      if (currentYearId) {
        gradeQuery = gradeQuery.eq("school_year_id", currentYearId);
      }

      const { data: gradeClasses, error: gcErr } = await gradeQuery;
      if (gcErr) {
        logServerError("teacher-home.loadGradeClasses", gcErr.message);
        return { classes: [], error: GENERIC_INFORMATION_LOAD_ERROR };
      }

      for (const klass of (gradeClasses ?? []) as unknown as ClassEmbed[]) {
        if (!klass?.id || klass.is_active === false) continue;
        if (!classBelongsToCurrentYear(classYearId(klass), currentYearId)) continue;
        if (seen.has(klass.id)) continue;
        seen.add(klass.id);
        assigned.push({
          id: klass.id,
          name: klass.name?.trim() || "Class",
          section: klass.section?.trim() || null,
          assignmentRole: "grade_access",
          schoolYearId: classYearId(klass),
          schoolYearLabel: unwrapOne(klass.school_years)?.label?.trim() || "",
        });
      }
    }
  }

  assigned.sort((a, b) =>
    formatClassTitle(a.name, a.section).localeCompare(
      formatClassTitle(b.name, b.section),
      undefined,
      { sensitivity: "base" },
    ),
  );

  return { classes: assigned, error: null };
}

function studentDisplayName(row: {
  preferred_name: string | null;
  first_name: string;
  last_name: string;
}): string {
  const pref = row.preferred_name?.trim();
  if (pref) return pref;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Student";
}

/**
 * Compact Teacher Home loader — counts and small summaries only.
 * Does not load full rosters, gradebooks, or complete note/file tables.
 */
export const loadTeacherHomeData = cache(async (): Promise<TeacherHomeData> => {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const user = await getUser();
  if (!user?.id) {
    return { ok: false, message: "You need to be signed in to view your classes." };
  }

  const supabase = await createServerSupabaseClient();
  const yearRes = await loadCurrentSchoolYear(supabase);
  if (!yearRes.ok) {
    return { ok: false, message: yearRes.error };
  }

  const currentYear = yearRes.year;
  const assignedRes = await loadAssignedClasses(
    supabase,
    user.id,
    currentYear?.id ?? null,
  );
  if (assignedRes.error && assignedRes.classes.length === 0) {
    return { ok: false, message: assignedRes.error };
  }

  const classes = assignedRes.classes;
  const classIds = classes.map((cls) => cls.id);
  const todayIso = schoolTodayIso();
  let error: string | null = assignedRes.error;

  const emptyRecords = summarizeTeacherRecords({
    enrolledCount: 0,
    transitionSubmittedCount: 0,
    transitionWorkflowStarted: false,
    reportingStarted: false,
    reportCompleteCount: null,
  });

  if (classIds.length === 0) {
    return {
      ok: true,
      classes: [],
      checkIn: [],
      positiveNoteCount: 0,
      records: emptyRecords,
      quickAccess: buildQuickAccess({
        classCount: 0,
        studentCount: 0,
        classesRequiringAttendance: 0,
        classesNotSubmitted: 0,
        checkInCount: 0,
        reportSummary: "Not started",
      }),
      studentCount: 0,
      error,
    };
  }

  const enrollmentsRes = await supabase
    .from("student_enrollments")
    .select("class_id, student_id")
    .eq("status", "active")
    .in("class_id", classIds);

  if (enrollmentsRes.error) {
    logServerError("teacher-home.loadEnrollments", enrollmentsRes.error.message);
    return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
  }

  const enrollments = enrollmentsRes.data ?? [];
  const counts = new Map<string, number>();
  const studentIds = new Set<string>();
  const rosterKeys: { studentId: string; classId: string; schoolYearLabel: string }[] =
    [];

  for (const row of enrollments) {
    if (!row.class_id || !row.student_id) continue;
    counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
    studentIds.add(row.student_id);
    const klass = classes.find((cls) => cls.id === row.class_id);
    rosterKeys.push({
      studentId: row.student_id,
      classId: row.class_id,
      schoolYearLabel: klass?.schoolYearLabel || currentYear?.label || "",
    });
  }

  const attendanceRes = await supabase
    .from("attendance_records")
    .select("class_id, student_id")
    .in("class_id", classIds)
    .eq("attendance_date", todayIso);

  if (attendanceRes.error) {
    logServerError("teacher-home.loadAttendance", attendanceRes.error.message);
    error = GENERIC_INFORMATION_LOAD_ERROR;
  }

  const markedByClass = new Map<string, Set<string>>();
  for (const row of attendanceRes.data ?? []) {
    const set = markedByClass.get(row.class_id) ?? new Set<string>();
    set.add(row.student_id);
    markedByClass.set(row.class_id, set);
  }

  const classCards: TeacherHomeClassCard[] = classes.map((cls) => {
    const studentCount = counts.get(cls.id) ?? 0;
    const markedCount = markedByClass.get(cls.id)?.size ?? 0;
    return {
      id: cls.id,
      title: formatClassTitle(cls.name, cls.section),
      studentCount,
      roleLabel: formatAssignmentRole(cls.assignmentRole),
      attendance: attendanceStatusForClass({ studentCount, markedCount }),
      classHref: `${BASE}/classes/${cls.id}`,
      attendanceHref: classWorkspaceAttendanceHref(cls.id),
    };
  });

  const distinctStudentIds = [...studentIds];
  const classesRequiringAttendance = classCards.filter(
    (cls) => cls.attendance !== "not_required",
  ).length;
  const classesNotSubmitted = classCards.filter(
    (cls) => cls.attendance === "not_submitted",
  ).length;

  const [signalsByKey, termsRes, transitionRes, filesRes] = await Promise.all([
    loadCheckInSignals(rosterKeys),
    currentYear
      ? supabase
          .from("terms")
          .select("code, name, starts_on, ends_on")
          .eq("school_year_id", currentYear.id)
          .order("starts_on", { ascending: true })
      : Promise.resolve({
          data: [] as { code: string; name: string; starts_on: string; ends_on: string }[],
          error: null,
        }),
    loadSubmittedAndAnyNotes(supabase, distinctStudentIds),
    loadReportCardFiles(supabase, distinctStudentIds, currentYear?.label ?? null),
  ]);

  if (termsRes.error) {
    logServerError("teacher-home.loadTerms", termsRes.error.message);
    error = GENERIC_INFORMATION_LOAD_ERROR;
  }

  const candidates: {
    studentId: string;
    reason: TeacherCheckInReason;
    missingAssignmentCount: number;
  }[] = [];

  for (const key of rosterKeys) {
    const signal = signalsByKey.get(`${key.studentId}:${key.classId}`);
    if (!signal?.reason) continue;
    candidates.push({
      studentId: key.studentId,
      reason: signal.reason,
      missingAssignmentCount: signal.missingAssignmentCount,
    });
  }

  const allRanked = rankCheckInStudents(candidates, candidates.length);
  const ranked = allRanked.slice(0, TEACHER_HOME_CHECK_IN_LIMIT);
  const nameById = await loadStudentNames(
    supabase,
    ranked.map((row) => row.studentId),
  );
  const checkIn: TeacherHomeCheckInStudent[] = ranked.map((row) => ({
    studentId: row.studentId,
    displayName: nameById.get(row.studentId) ?? "Student",
    reason: row.reason,
    detail: checkInDetailLabel({
      reason: row.reason,
      missingAssignmentCount: row.missingAssignmentCount,
    }),
    href: classWorkspaceStudentInterventionsHref(row.studentId),
  }));
  const positiveNoteCount = countPositiveRecognition(signalsByKey.values());

  const cycle = resolveReportingCycle({
    schoolYearLabel: currentYear?.label ?? null,
    terms: (termsRes.data ?? []).map((term) => ({
      code: term.code,
      name: term.name,
      startsOn: term.starts_on,
      endsOn: term.ends_on,
    })),
    todayIso,
  });
  const reportingStarted =
    cycle.termsConfigured && cycle.status !== "not_started" && Boolean(cycle.term);
  const reportCompleteCount =
    reportingStarted && cycle.term
      ? countCompleteStudents(distinctStudentIds, filesRes, cycle.term.code)
      : null;

  const records = summarizeTeacherRecords({
    enrolledCount: distinctStudentIds.length,
    transitionSubmittedCount: transitionRes.submittedCount,
    transitionWorkflowStarted: transitionRes.workflowStarted,
    reportingStarted,
    reportCompleteCount,
  });

  return {
    ok: true,
    classes: classCards,
    checkIn,
    positiveNoteCount,
    records,
    quickAccess: buildQuickAccess({
      classCount: classCards.length,
      studentCount: distinctStudentIds.length,
      classesRequiringAttendance,
      classesNotSubmitted,
      checkInCount: allRanked.length,
      reportSummary: reportCardsQuickAccessSummary({
        reportingStarted,
        enrolledCount: distinctStudentIds.length,
        completeCount: reportCompleteCount,
      }),
    }),
    studentCount: distinctStudentIds.length,
    error,
  };
});

export const loadTeacherHomeGreetingName = loadAdminOverviewGreetingName;

function buildQuickAccess(args: {
  classCount: number;
  studentCount: number;
  classesRequiringAttendance: number;
  classesNotSubmitted: number;
  checkInCount: number;
  reportSummary: string;
}): TeacherHomeQuickAccessCard[] {
  return [
    {
      id: "classes",
      title: "My Classes",
      path: `${BASE}/classes`,
      summary:
        args.classCount === 1 ? "1 assigned" : `${args.classCount} assigned`,
    },
    {
      id: "attendance",
      title: "Attendance",
      path: `${BASE}/attendance`,
      summary: attendanceQuickAccessSummary({
        classesRequiringAttendance: args.classesRequiringAttendance,
        classesNotSubmitted: args.classesNotSubmitted,
      }),
    },
    {
      id: "students",
      title: "Students",
      path: `${BASE}/students`,
      summary:
        args.studentCount === 1 ? "1 student" : `${args.studentCount} students`,
    },
    {
      id: "gradebook",
      title: "Gradebook",
      path: `${BASE}/gradebook`,
      summary: "Open gradebook",
    },
    {
      id: "report-cards",
      title: "Report Cards",
      path: `${BASE}/report-cards`,
      summary: args.reportSummary,
    },
    {
      id: "support",
      title: "Support",
      path: `${BASE}/interventions`,
      summary: supportQuickAccessSummary(args.checkInCount),
    },
  ];
}

async function loadSubmittedAndAnyNotes(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentIds: string[],
): Promise<{ submittedCount: number; workflowStarted: boolean }> {
  if (studentIds.length === 0) {
    return { submittedCount: 0, workflowStarted: false };
  }

  const submitted = new Set<string>();
  let workflowStarted = false;

  for (const part of chunkIds(studentIds)) {
    const { data, error } = await supabase
      .from("transition_notes")
      .select("student_id, status")
      .in("student_id", part);

    if (error) {
      logServerError("teacher-home.transitionNotes", error.message);
      continue;
    }
    for (const row of data ?? []) {
      workflowStarted = true;
      if (row.status === "submitted") submitted.add(row.student_id);
    }
  }

  return { submittedCount: submitted.size, workflowStarted };
}

async function loadReportCardFiles(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentIds: string[],
  schoolYearLabel: string | null,
): Promise<ReportingFileInput[]> {
  if (studentIds.length === 0 || !schoolYearLabel) return [];

  const files: ReportingFileInput[] = [];
  for (const part of chunkIds(studentIds)) {
    const { data, error } = await supabase
      .from("report_card_files")
      .select("id, student_id, term, status, voided_at, updated_at")
      .in("student_id", part)
      .eq("school_year", schoolYearLabel);

    if (error) {
      logServerError("teacher-home.reportCards", error.message);
      continue;
    }
    for (const row of data ?? []) {
      if (row.status !== "draft" && row.status !== "final" && row.status !== "archive") {
        continue;
      }
      files.push({
        id: row.id,
        studentId: row.student_id,
        term: row.term,
        status: row.status,
        voidedAt: row.voided_at,
        updatedAt: row.updated_at,
      });
    }
  }
  return files;
}

async function loadStudentNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (studentIds.length === 0) return names;

  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, preferred_name")
    .in("id", studentIds);

  if (error) {
    logServerError("teacher-home.studentNames", error.message);
    return names;
  }

  for (const row of data ?? []) {
    names.set(row.id, studentDisplayName(row));
  }
  return names;
}
