/**
 * Pure reporting-cycle and completion helpers for the leadership workspace.
 * Counts are honest: no invented deadlines, percentages, or teacher ownership.
 */

export type ReportingCycleStatus = "not_started" | "in_progress" | "complete";

export type ReportingTermInput = {
  code: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
};

export type ReportingFileInput = {
  id: string;
  studentId: string;
  term: string;
  status: "draft" | "final" | "archive";
  voidedAt: string | null;
  updatedAt: string;
};

export type ClassProgressStatus =
  | "complete"
  | "in_progress"
  | "not_started"
  | "needs_follow_up";

export type StudentReportPresence = "final" | "draft" | "missing";

/** File rows that may count toward coverage (not archived, not voided). */
export function isCountableReportFile(file: ReportingFileInput): boolean {
  if (file.voidedAt) return false;
  if (file.status === "archive") return false;
  return file.status === "draft" || file.status === "final";
}

/**
 * Best active file for a student in one term.
 * Final beats draft. Newer updatedAt wins ties. Duplicates never inflate counts.
 */
export function pickBestReportFile(
  files: ReportingFileInput[],
  studentId: string,
  term: string,
): ReportingFileInput | null {
  let best: ReportingFileInput | null = null;
  for (const file of files) {
    if (file.studentId !== studentId) continue;
    if (file.term.trim() !== term) continue;
    if (!isCountableReportFile(file)) continue;
    if (!best) {
      best = file;
      continue;
    }
    if (file.status === "final" && best.status !== "final") {
      best = file;
      continue;
    }
    if (file.status === best.status && file.updatedAt > best.updatedAt) {
      best = file;
    }
  }
  return best;
}

export function studentReportPresence(
  files: ReportingFileInput[],
  studentId: string,
  term: string,
): StudentReportPresence {
  const best = pickBestReportFile(files, studentId, term);
  if (!best) return "missing";
  return best.status === "final" ? "final" : "draft";
}

export function studentIsComplete(
  files: ReportingFileInput[],
  studentId: string,
  term: string,
): boolean {
  return studentReportPresence(files, studentId, term) === "final";
}

/**
 * Resolve the active reporting cycle from configured school year + terms.
 * Status is calendar-only (term dates vs today) — never invented due dates.
 */
export function resolveReportingCycle(args: {
  schoolYearLabel: string | null;
  terms: ReportingTermInput[];
  todayIso: string;
}): {
  status: ReportingCycleStatus;
  termsConfigured: boolean;
  term: ReportingTermInput | null;
} {
  const label = args.schoolYearLabel?.trim() || null;
  const terms = args.terms
    .map((t) => ({
      ...t,
      code: t.code.trim(),
      name: t.name.trim() || t.code.trim(),
      startsOn: t.startsOn?.trim() || null,
      endsOn: t.endsOn?.trim() || null,
    }))
    .filter((t) => t.code)
    .sort((a, b) => {
      // Undated terms sort after dated ones; keep code order among undated.
      if (a.startsOn && b.startsOn) return a.startsOn.localeCompare(b.startsOn);
      if (a.startsOn) return -1;
      if (b.startsOn) return 1;
      return a.code.localeCompare(b.code);
    });

  if (!label || terms.length === 0) {
    return { status: "not_started", termsConfigured: false, term: null };
  }

  // Calendar progress only uses terms with both bounds set.
  const dated = terms.filter((t) => t.startsOn && t.endsOn) as Array<
    ReportingTermInput & { startsOn: string; endsOn: string }
  >;

  const current = dated.find(
    (t) => t.startsOn <= args.todayIso && args.todayIso <= t.endsOn,
  );
  if (current) {
    return { status: "in_progress", termsConfigured: true, term: current };
  }

  const ended = dated.filter((t) => t.endsOn < args.todayIso);
  if (dated.length > 0 && ended.length === dated.length) {
    return {
      status: "complete",
      termsConfigured: true,
      term: ended[ended.length - 1] ?? null,
    };
  }

  if (ended.length > 0) {
    return {
      status: "in_progress",
      termsConfigured: true,
      term: ended[ended.length - 1] ?? null,
    };
  }

  return {
    status: "not_started",
    termsConfigured: true,
    term: dated[0] ?? terms[0] ?? null,
  };
}

/**
 * Same honesty gate as the admin dashboard signal:
 * coverage is only claimed after at least one term has ended, or when a term
 * is in progress and we can still show started/complete counts for that term.
 */
export function reportingHasStarted(args: {
  cycleStatus: ReportingCycleStatus;
  termsConfigured: boolean;
}): boolean {
  if (!args.termsConfigured) return false;
  return args.cycleStatus !== "not_started";
}

export function classProgressStatus(args: {
  studentCount: number;
  completeCount: number;
  startedCount: number;
  termEnded: boolean;
}): ClassProgressStatus {
  if (args.studentCount <= 0) return "not_started";
  if (args.completeCount >= args.studentCount) return "complete";
  if (args.termEnded && args.completeCount < args.studentCount) {
    return "needs_follow_up";
  }
  if (args.startedCount > 0 || args.completeCount > 0) return "in_progress";
  return "not_started";
}

export const classProgressStatusLabel: Record<ClassProgressStatus, string> = {
  complete: "Complete",
  in_progress: "In progress",
  not_started: "Not started",
  needs_follow_up: "Needs follow-up",
};

export const cycleStatusLabel: Record<ReportingCycleStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

export function uniqueStudentIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function countCompleteStudents(
  studentIds: string[],
  files: ReportingFileInput[],
  term: string,
): number {
  let complete = 0;
  for (const id of uniqueStudentIds(studentIds)) {
    if (studentIsComplete(files, id, term)) complete += 1;
  }
  return complete;
}

export function countStartedStudents(
  studentIds: string[],
  files: ReportingFileInput[],
  term: string,
): number {
  let started = 0;
  for (const id of uniqueStudentIds(studentIds)) {
    if (studentReportPresence(files, id, term) !== "missing") started += 1;
  }
  return started;
}

export function matchesStudentSearch(
  row: {
    studentName: string;
    studentNumber: string | null;
    classLabel: string;
    gradeLabel?: string | null;
  },
  raw: string,
): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.studentName,
    row.studentNumber ?? "",
    row.classLabel,
    row.gradeLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
