import "server-only";

import { cache } from "react";

import { schoolTodayIso } from "@/features/calendar/school-timezone";
import {
  countCompleteStudents,
  resolveReportingCycle,
  type ReportingFileInput,
} from "@/features/report-cards/reporting-progress";
import {
  GENERIC_INFORMATION_LOAD_ERROR,
  logServerError,
} from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  buildReportCardStudentRows,
  buildTransitionStudentRows,
  summarizeClassReportCards,
  summarizeClassTransitionNotes,
  type ClassRecordsReportSummary,
  type ClassRecordsTransitionSummary,
  type ClassRecordStudentStatus,
} from "./class-records";
import { teacherStudentDisplayName } from "./class-roster";
import {
  classWorkspacePath,
  classWorkspaceReportCardsHref,
  classWorkspaceStudentReportCardsHref,
  classWorkspaceStudentTransitionNoteHref,
} from "./constants";
import { loadTeacherClassContext } from "./load-teacher-class-context";

const IN_CHUNK = 120;

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

function chunkIds(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, IN_CHUNK + i));
  }
  return out;
}

export type ClassRecordsStudentRow = {
  studentId: string;
  displayName: string;
  status: ClassRecordStudentStatus;
  statusLabel: string;
  href: string;
};

export type TeacherClassRecordsData =
  | {
      ok: true;
      classId: string;
      isCurrentYear: boolean;
      reportCards: ClassRecordsReportSummary;
      transition: ClassRecordsTransitionSummary;
      reportCardStudents: ClassRecordsStudentRow[];
      transitionStudents: ClassRecordsStudentRow[];
      reportCardsWorkspaceHref: string;
      recordsIndexHref: string;
      termCode: string | null;
      termName: string | null;
    }
  | { ok: false; message: string };

/**
 * Class Records — report cards + transition notes for one assigned class.
 * Index shows honest summaries; detail lists load only when the teacher opens a workflow.
 */
export const loadTeacherClassRecords = cache(
  async (classId: string): Promise<TeacherClassRecordsData> => {
    const ctx = await loadTeacherClassContext(classId);
    if (!ctx.ok) return ctx;

    if (!isSupabaseConfigured()) {
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const supabase = await createServerSupabaseClient();
    const yearRes = await loadCurrentSchoolYear(supabase);
    if (!yearRes.ok) {
      return { ok: false, message: yearRes.error };
    }

    const { isCurrentYear } = ctx.context;
    const currentYear = yearRes.year;
    const todayIso = schoolTodayIso();
    const recordsIndexHref = classWorkspacePath(classId, "records");
    const reportCardsWorkspaceHref = classWorkspaceReportCardsHref(classId);

    const enrollmentsRes = await supabase
      .from("student_enrollments")
      .select(
        `
        student_id,
        students!inner (
          id,
          first_name,
          last_name,
          preferred_name
        )
      `,
      )
      .eq("class_id", classId)
      .eq("status", "active");

    if (enrollmentsRes.error) {
      logServerError("class-records.loadEnrollments", enrollmentsRes.error.message);
      return { ok: false, message: GENERIC_INFORMATION_LOAD_ERROR };
    }

    const students: { studentId: string; displayName: string }[] = [];
    for (const raw of enrollmentsRes.data ?? []) {
      const student = unwrapOne(
        (raw as { students: StudentEmbed | StudentEmbed[] | null }).students,
      );
      if (!student?.id) continue;
      students.push({
        studentId: student.id,
        displayName: teacherStudentDisplayName({
          preferredName: student.preferred_name,
          firstName: student.first_name ?? "",
          lastName: student.last_name ?? "",
        }),
      });
    }

    students.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );

    const studentIds = students.map((row) => row.studentId);

    if (studentIds.length === 0) {
      return {
        ok: true,
        classId,
        isCurrentYear,
        reportCards: summarizeClassReportCards({
          isCurrentYear,
          reportingStarted: false,
          enrolledCount: 0,
          completeCount: null,
        }),
        transition: summarizeClassTransitionNotes({
          workflowStarted: false,
          enrolledCount: 0,
          submittedCount: 0,
        }),
        reportCardStudents: [],
        transitionStudents: [],
        reportCardsWorkspaceHref,
        recordsIndexHref,
        termCode: null,
        termName: null,
      };
    }

    const [termsRes, files, transitionRes] = await Promise.all([
      currentYear && isCurrentYear
        ? supabase
            .from("terms")
            .select("code, name, starts_on, ends_on")
            .eq("school_year_id", currentYear.id)
            .order("starts_on", { ascending: true })
        : Promise.resolve({
            data: [] as { code: string; name: string; starts_on: string; ends_on: string }[],
            error: null,
          }),
      isCurrentYear
        ? loadReportCardFiles(supabase, studentIds, currentYear?.label ?? null)
        : Promise.resolve([] as ReportingFileInput[]),
      loadTransitionNotes(supabase, studentIds),
    ]);

    if (termsRes.error) {
      logServerError("class-records.loadTerms", termsRes.error.message);
    }

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
      isCurrentYear &&
      cycle.termsConfigured &&
      cycle.status !== "not_started" &&
      Boolean(cycle.term);
    const termCode = reportingStarted ? cycle.term?.code ?? null : null;
    const termName = reportingStarted ? cycle.term?.name ?? termCode : null;
    const completeCount =
      reportingStarted && termCode
        ? countCompleteStudents(studentIds, files, termCode)
        : null;

    const reportCards = summarizeClassReportCards({
      isCurrentYear,
      reportingStarted,
      enrolledCount: studentIds.length,
      completeCount,
    });

    const transition = summarizeClassTransitionNotes({
      workflowStarted: transitionRes.workflowStarted,
      enrolledCount: studentIds.length,
      submittedCount: transitionRes.submitted.size,
    });

    const reportCardStudents = buildReportCardStudentRows({
      students,
      files,
      term: termCode,
      reportingStarted,
      isCurrentYear,
    }).map((row) => ({
      ...row,
      href: classWorkspaceStudentReportCardsHref(row.studentId),
    }));

    const transitionStudents = buildTransitionStudentRows({
      students,
      submittedIds: transitionRes.submitted,
      noteIds: transitionRes.anyNote,
      workflowStarted: transition.relevant,
    }).map((row) => ({
      ...row,
      href: classWorkspaceStudentTransitionNoteHref(row.studentId),
    }));

    return {
      ok: true,
      classId,
      isCurrentYear,
      reportCards,
      transition,
      reportCardStudents,
      transitionStudents,
      reportCardsWorkspaceHref,
      recordsIndexHref,
      termCode,
      termName,
    };
  },
);

async function loadTransitionNotes(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  studentIds: string[],
): Promise<{
  submitted: Set<string>;
  anyNote: Set<string>;
  workflowStarted: boolean;
}> {
  const submitted = new Set<string>();
  const anyNote = new Set<string>();
  let workflowStarted = false;
  if (studentIds.length === 0) {
    return { submitted, anyNote, workflowStarted };
  }

  for (const part of chunkIds(studentIds)) {
    const { data, error } = await supabase
      .from("transition_notes")
      .select("student_id, status")
      .in("student_id", part);

    if (error) {
      logServerError("class-records.transitionNotes", error.message);
      continue;
    }
    for (const row of data ?? []) {
      workflowStarted = true;
      anyNote.add(row.student_id);
      if (row.status === "submitted") submitted.add(row.student_id);
    }
  }

  return { submitted, anyNote, workflowStarted };
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
      logServerError("class-records.reportCards", error.message);
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
