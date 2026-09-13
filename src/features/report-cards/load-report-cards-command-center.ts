import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/config/roles";
import { canViewSchoolSettings } from "@/config/roles";
import { todayIso } from "@/features/attendance/attendance-date-utils";
import {
  classProgressStatus,
  countCompleteStudents,
  countStartedStudents,
  pickBestReportFile,
  reportingHasStarted,
  resolveReportingCycle,
  studentReportPresence,
  type ClassProgressStatus,
  type ReportingCycleStatus,
  type ReportingFileInput,
  type StudentReportPresence,
} from "@/features/report-cards/reporting-progress";
import { logServerError } from "@/lib/errors/safe-user-message";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { formatStaffDirectoryName } from "@/lib/staff/format-staff-profile-label";
import { isUuid } from "@/lib/students/uuid";
import type { Database } from "@/types/database.types";

export const REPORT_CARDS_LOAD_ERROR =
  "We couldn't load report cards right now. Try again.";

export type ReportingWorkspaceView =
  | "overview"
  | "class"
  | "student"
  | "library";

export type CommandCenterCycle = {
  schoolYearLabel: string | null;
  schoolYearId: string | null;
  termCode: string | null;
  termName: string | null;
  status: ReportingCycleStatus;
  termsConfigured: boolean;
  termEnded: boolean;
  setupHref: string | null;
};

export type CommandCenterOverview = {
  coverageKnown: boolean;
  reportingStarted: boolean;
  studentCount: number | null;
  completeCount: number | null;
  remainingCount: number | null;
  classesReportingCount: number | null;
  classCount: number | null;
};

export type CommandCenterClassRow = {
  classId: string;
  classLabel: string;
  teacherName: string | null;
  studentCount: number;
  completeCount: number;
  remainingCount: number;
  status: ClassProgressStatus;
};

export type CommandCenterStudentRow = {
  studentId: string;
  studentName: string;
  studentNumber: string | null;
  classId: string;
  classLabel: string;
  gradeLabel: string | null;
  termCode: string | null;
  presence: StudentReportPresence;
  lastUpdated: string | null;
  fileId: string | null;
};

export type ReportCardsCommandCenter = {
  cycle: CommandCenterCycle;
  overview: CommandCenterOverview;
  classes: CommandCenterClassRow[];
  students: CommandCenterStudentRow[];
  teachersAvailable: boolean;
  yearOptions: string[];
  error: string | null;
};

function emptyCycle(setupHref: string | null): CommandCenterCycle {
  return {
    schoolYearLabel: null,
    schoolYearId: null,
    termCode: null,
    termName: null,
    status: "not_started",
    termsConfigured: false,
    termEnded: false,
    setupHref,
  };
}

function emptyOverview(): CommandCenterOverview {
  return {
    coverageKnown: true,
    reportingStarted: false,
    studentCount: null,
    completeCount: null,
    remainingCount: null,
    classesReportingCount: null,
    classCount: null,
  };
}

function classLabel(name: string, section: string | null): string {
  const base = name.trim() || "Class";
  const sec = section?.trim();
  return sec ? `${base} · ${sec}` : base;
}

function studentDisplayName(row: {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
}): string {
  const pref = row.preferred_name?.trim();
  if (pref) return pref;
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Student";
}

function setupHrefFor(role: Role): string | null {
  if (!canViewSchoolSettings(role)) return null;
  return `/dashboard/${role}/school-settings#academic-structure`;
}

export function parseReportCardsView(
  raw: string | undefined,
): ReportingWorkspaceView {
  if (raw === "class" || raw === "student" || raw === "library") return raw;
  return "overview";
}

export function pickReportCardsClassId(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const raw = searchParams.classId ?? searchParams.class;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && isUuid(value)) return value;
  return null;
}

export async function loadReportCardsCommandCenter(
  supabase: SupabaseClient<Database>,
  role: Role,
): Promise<ReportCardsCommandCenter> {
  const setupHref = setupHrefFor(role);
  const today = todayIso();

  const currentYearRes = await loadCurrentSchoolYear(supabase);
  if (!currentYearRes.ok) {
    return {
      cycle: emptyCycle(setupHref),
      overview: { ...emptyOverview(), coverageKnown: false },
      classes: [],
      students: [],
      teachersAvailable: false,
      yearOptions: [],
      error: REPORT_CARDS_LOAD_ERROR,
    };
  }

  const yearsRes = await supabase
    .from("school_years")
    .select("label")
    .is("archived_at", null)
    .order("starts_on", { ascending: false });
  if (yearsRes.error) {
    logServerError("report-cards.commandCenter.years", yearsRes.error.message);
  }
  const yearOptions = yearsRes.error
    ? []
    : (yearsRes.data ?? [])
        .map((y) => y.label?.trim())
        .filter((label): label is string => Boolean(label));

  const schoolYear = currentYearRes.year;
  if (!schoolYear) {
    return {
      cycle: emptyCycle(setupHref),
      overview: emptyOverview(),
      classes: [],
      students: [],
      teachersAvailable: false,
      yearOptions,
      error: null,
    };
  }

  const termsRes = await supabase
    .from("terms")
    .select("code, name, starts_on, ends_on")
    .eq("school_year_id", schoolYear.id)
    .order("starts_on", { ascending: true });

  if (termsRes.error) {
    logServerError("report-cards.commandCenter.terms", termsRes.error.message);
    return {
      cycle: {
        ...emptyCycle(setupHref),
        schoolYearLabel: schoolYear.label,
        schoolYearId: schoolYear.id,
      },
      overview: { ...emptyOverview(), coverageKnown: false },
      classes: [],
      students: [],
      teachersAvailable: false,
      yearOptions,
      error: REPORT_CARDS_LOAD_ERROR,
    };
  }

  const cycleResolved = resolveReportingCycle({
    schoolYearLabel: schoolYear.label,
    terms: (termsRes.data ?? []).map((t) => ({
      code: t.code,
      name: t.name,
      startsOn: t.starts_on,
      endsOn: t.ends_on,
    })),
    todayIso: today,
  });

  const cycle: CommandCenterCycle = {
    schoolYearLabel: schoolYear.label,
    schoolYearId: schoolYear.id,
    termCode: cycleResolved.term?.code ?? null,
    termName: cycleResolved.term?.name ?? cycleResolved.term?.code ?? null,
    status: cycleResolved.status,
    termsConfigured: cycleResolved.termsConfigured,
    termEnded: Boolean(
      cycleResolved.term?.endsOn && cycleResolved.term.endsOn < today,
    ),
    setupHref,
  };

  const classesRes = await supabase
    .from("classes")
    .select("id, name, section, grade_level_id")
    .eq("school_year_id", schoolYear.id)
    .eq("is_active", true)
    .order("name");

  if (classesRes.error) {
    logServerError("report-cards.commandCenter.classes", classesRes.error.message);
    return {
      cycle,
      overview: { ...emptyOverview(), coverageKnown: false },
      classes: [],
      students: [],
      teachersAvailable: false,
      yearOptions,
      error: REPORT_CARDS_LOAD_ERROR,
    };
  }

  const classRows = classesRes.data ?? [];
  const classIds = classRows.map((c) => c.id);
  const classById = new Map(classRows.map((c) => [c.id, c]));

  const enrollmentsRes =
    classIds.length > 0
      ? await supabase
          .from("student_enrollments")
          .select("student_id, class_id")
          .in("class_id", classIds)
          .eq("status", "active")
      : { data: [] as { student_id: string; class_id: string }[], error: null };

  if (enrollmentsRes.error) {
    logServerError(
      "report-cards.commandCenter.enrollments",
      enrollmentsRes.error.message,
    );
    return {
      cycle,
      overview: { ...emptyOverview(), coverageKnown: false },
      classes: [],
      students: [],
      teachersAvailable: false,
      yearOptions,
      error: REPORT_CARDS_LOAD_ERROR,
    };
  }

  const enrollments = enrollmentsRes.data ?? [];
  const studentIds = [...new Set(enrollments.map((r) => r.student_id))];

  const gradeIds = [
    ...new Set(
      classRows
        .map((c) => c.grade_level_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const studentsPromise =
    studentIds.length > 0
      ? supabase
          .from("students")
          .select("id, first_name, last_name, preferred_name, external_id")
          .in("id", studentIds)
      : Promise.resolve({ data: [] as const, error: null });

  const gradesPromise =
    gradeIds.length > 0
      ? supabase.from("grade_levels").select("id, name").in("id", gradeIds)
      : Promise.resolve({ data: [] as const, error: null });

  const teachersPromise =
    classIds.length > 0
      ? supabase
          .from("class_teachers")
          .select("class_id, teacher_profile_id")
          .in("class_id", classIds)
      : Promise.resolve({ data: [] as const, error: null });

  const filesPromise = cycle.termCode
    ? supabase
        .from("report_card_files")
        .select("id, student_id, term, status, voided_at, updated_at")
        .eq("school_year", schoolYear.label)
        .eq("term", cycle.termCode)
    : Promise.resolve({ data: [] as const, error: null });

  const [studentsRes, gradesRes, teachersRes, filesRes] = await Promise.all([
    studentsPromise,
    gradesPromise,
    teachersPromise,
    filesPromise,
  ]);

  if (studentsRes.error) {
    logServerError("report-cards.commandCenter.students", studentsRes.error.message);
    return {
      cycle,
      overview: { ...emptyOverview(), coverageKnown: false },
      classes: [],
      students: [],
      teachersAvailable: false,
      yearOptions,
      error: REPORT_CARDS_LOAD_ERROR,
    };
  }

  if (gradesRes.error) {
    logServerError("report-cards.commandCenter.grades", gradesRes.error.message);
  }

  let teachersAvailable = false;
  const teacherNamesByClass = new Map<string, string[]>();
  if (!teachersRes.error) {
    const teacherIds = [
      ...new Set(
        (teachersRes.data ?? []).map((t) => t.teacher_profile_id).filter(Boolean),
      ),
    ];
    if (teacherIds.length > 0) {
      const profilesRes = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teacherIds);
      if (profilesRes.error) {
        logServerError(
          "report-cards.commandCenter.teacherProfiles",
          profilesRes.error.message,
        );
      } else {
        teachersAvailable = true;
        const nameById = new Map<string, string>();
        for (const p of profilesRes.data ?? []) {
          const label = formatStaffDirectoryName({
            id: p.id,
            full_name: p.full_name,
            email: p.email,
          });
          if (label && label !== "Staff member") {
            nameById.set(p.id, label);
          }
        }
        for (const row of teachersRes.data ?? []) {
          const name = nameById.get(row.teacher_profile_id);
          if (!name) continue;
          const list = teacherNamesByClass.get(row.class_id) ?? [];
          if (!list.includes(name)) list.push(name);
          teacherNamesByClass.set(row.class_id, list);
        }
      }
    } else {
      teachersAvailable = true;
    }
  }

  const coverageKnown = !filesRes.error;
  if (filesRes.error) {
    logServerError("report-cards.commandCenter.files", filesRes.error.message);
  }

  const files: ReportingFileInput[] = coverageKnown
    ? (filesRes.data ?? []).map((row) => ({
        id: row.id,
        studentId: row.student_id,
        term: row.term,
        status: row.status,
        voidedAt: row.voided_at,
        updatedAt: row.updated_at,
      }))
    : [];

  const gradeNameById = new Map(
    (gradesRes.data ?? []).map((g) => [g.id, g.name?.trim() || null]),
  );
  const studentById = new Map(
    (studentsRes.data ?? []).map((s) => [s.id, s]),
  );

  const started = reportingHasStarted({
    cycleStatus: cycle.status,
    termsConfigured: cycle.termsConfigured,
  });
  const term = cycle.termCode;

  const classStudentIds = new Map<string, string[]>();
  for (const row of enrollments) {
    const list = classStudentIds.get(row.class_id) ?? [];
    list.push(row.student_id);
    classStudentIds.set(row.class_id, list);
  }

  const classes: CommandCenterClassRow[] = classRows.map((c) => {
    const roster = [...new Set(classStudentIds.get(c.id) ?? [])];
    const completeCount =
      started && coverageKnown && term
        ? countCompleteStudents(roster, files, term)
        : 0;
    const startedCount =
      started && coverageKnown && term
        ? countStartedStudents(roster, files, term)
        : 0;
    const remainingCount = Math.max(0, roster.length - completeCount);
    const teacherNames = teacherNamesByClass.get(c.id) ?? [];
    return {
      classId: c.id,
      classLabel: classLabel(c.name, c.section),
      teacherName: teacherNames.length > 0 ? teacherNames.join(", ") : null,
      studentCount: roster.length,
      completeCount,
      remainingCount,
      status:
        started && coverageKnown
          ? classProgressStatus({
              studentCount: roster.length,
              completeCount,
              startedCount,
              termEnded: cycle.termEnded,
            })
          : "not_started",
    };
  });

  const primaryClassByStudent = new Map<string, string>();
  for (const row of enrollments) {
    const prev = primaryClassByStudent.get(row.student_id);
    if (!prev) {
      primaryClassByStudent.set(row.student_id, row.class_id);
      continue;
    }
    const prevLabel = classById.get(prev);
    const nextLabel = classById.get(row.class_id);
    const a = prevLabel ? classLabel(prevLabel.name, prevLabel.section) : prev;
    const b = nextLabel ? classLabel(nextLabel.name, nextLabel.section) : row.class_id;
    if (b.localeCompare(a) < 0) {
      primaryClassByStudent.set(row.student_id, row.class_id);
    }
  }

  const students: CommandCenterStudentRow[] = studentIds
    .map((studentId) => {
      const student = studentById.get(studentId);
      const classId = primaryClassByStudent.get(studentId) ?? "";
      const klass = classById.get(classId);
      const best =
        started && coverageKnown && term
          ? pickBestReportFile(files, studentId, term)
          : null;
      const presence =
        started && coverageKnown && term
          ? studentReportPresence(files, studentId, term)
          : "missing";
      return {
        studentId,
        studentName: student
          ? studentDisplayName(student)
          : "Student",
        studentNumber: student?.external_id?.trim() || null,
        classId,
        classLabel: klass ? classLabel(klass.name, klass.section) : "—",
        gradeLabel: klass
          ? gradeNameById.get(klass.grade_level_id) ?? null
          : null,
        termCode: term,
        presence,
        lastUpdated: best?.updatedAt ?? null,
        fileId: best?.id ?? null,
      };
    })
    .sort((a, b) =>
      a.studentName.localeCompare(b.studentName, undefined, {
        sensitivity: "base",
      }),
    );

  const uniqueStudents = studentIds.length;
  const completeCount =
    started && coverageKnown && term
      ? countCompleteStudents(studentIds, files, term)
      : 0;
  const classesReportingCount =
    started && coverageKnown
      ? classes.filter((c) => c.completeCount > 0 || c.status === "in_progress")
          .length
      : 0;

  const overview: CommandCenterOverview = {
    coverageKnown,
    reportingStarted: started,
    studentCount: uniqueStudents,
    completeCount: started && coverageKnown ? completeCount : null,
    remainingCount:
      started && coverageKnown ? Math.max(0, uniqueStudents - completeCount) : null,
    classesReportingCount: started && coverageKnown ? classesReportingCount : null,
    classCount: classRows.length,
  };

  return {
    cycle,
    overview,
    classes,
    students,
    teachersAvailable,
    yearOptions,
    error: coverageKnown ? null : REPORT_CARDS_LOAD_ERROR,
  };
}
