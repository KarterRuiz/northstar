import "server-only";

import { cache } from "react";

import { REPORT_CARD_TERMS } from "@/lib/report-cards/constants";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type TransitionNoteReviewStatus = "submitted" | "draft" | "missing";

export type AcademicReviewRow = {
  key: string;
  studentId: string;
  studentDisplayName: string;
  classId: string;
  classLabel: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeSortOrder: number;
  homeroomTeacherId: string | null;
  homeroomTeacherLabel: string;
  transitionNoteStatus: TransitionNoteReviewStatus;
  missingReportCardTerms: readonly string[];
  reportCardTermsSatisfied: number;
  studentNeedsAttention: boolean;
};

export type AcademicReviewSearchParams = {
  gradeId: string | null;
  classId: string | null;
  teacherId: string | null;
  /** Transition note dimension: all | submitted | draft | missing | incomplete (draft or missing). */
  tn: string | null;
  /** Report cards: all | complete (all terms) | incomplete (any missing). */
  rc: string | null;
  sort: "student" | "class" | "teacher" | "grade";
};

export type AcademicReviewSummary = {
  schoolYearLabel: string;
  schoolYearId: string;
  activeEnrollmentCount: number;
  uniqueStudentCount: number;
  transitionSubmittedCount: number;
  transitionSubmittedPct: number;
  transitionDraftCount: number;
  transitionMissingCount: number;
  reportExpectedSlots: number;
  reportFilledSlots: number;
  reportFilledPct: number;
  studentsWithAllReportTerms: number;
  reportAllTermsPct: number;
  needsAttentionStudentCount: number;
  academicRecordDraftCount: number;
  academicRecordSubmittedCount: number;
  academicRecordReviewedCount: number;
  academicRecordArchivedCount: number;
  academicRecordTotalCount: number;
};

export type AcademicReviewFilterOptions = {
  grades: { id: string; name: string; sortOrder: number }[];
  classes: { id: string; label: string }[];
  teachers: { id: string; label: string }[];
};

export type AcademicReviewResult =
  | {
      ok: true;
      dbError: string | null;
      summary: AcademicReviewSummary;
      filterOptions: AcademicReviewFilterOptions;
      rows: AcademicReviewRow[];
    }
  | { ok: false; message: string };

type GradeEmbed = { id: string; name: string; sort_order: number } | null;
type ClassTeacherEmbed = {
  teacher_profile_id: string;
  role: string;
} | null;
type ClassEmbed = {
  id: string;
  name: string;
  section: string | null;
  is_active: boolean;
  grade_levels: GradeEmbed | GradeEmbed[] | null;
  class_teachers: ClassTeacherEmbed[] | ClassTeacherEmbed | null;
} | null;
type StudentEmbed = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
} | null;
type EnrollmentRow = {
  student_id: string;
  class_id: string;
  students: StudentEmbed | StudentEmbed[] | null;
  classes: ClassEmbed | ClassEmbed[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function displayStudentName(s: StudentEmbed): string {
  if (!s) return "—";
  const pref = s.preferred_name?.trim();
  if (pref) return pref;
  return [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "—";
}

function classLabel(c: NonNullable<ClassEmbed>): string {
  const base = c.name?.trim() || "Class";
  const sec = c.section?.trim();
  return sec ? `${base} · ${sec}` : base;
}

function pickHomeroomTeacherId(
  classTeachers: NonNullable<ClassEmbed>["class_teachers"],
): string | null {
  const listRaw = classTeachers;
  const list: ClassTeacherEmbed[] = Array.isArray(listRaw)
    ? listRaw
    : listRaw
      ? [listRaw]
      : [];
  const homerooms = list.filter((t) => t?.role === "homeroom" && t.teacher_profile_id);
  const pick =
    homerooms[0]?.teacher_profile_id ??
    list.find((t) => t?.teacher_profile_id)?.teacher_profile_id ??
    null;
  return pick;
}

function staffLabel(id: string): string {
  return `Staff ${id.replace(/-/g, "").slice(0, 8)}`;
}

function normalizeEnrollment(row: EnrollmentRow): {
  studentId: string;
  student: StudentEmbed;
  classId: string;
  klass: NonNullable<ClassEmbed>;
} | null {
  const student = first(row.students);
  const klass = first(row.classes);
  if (!student?.id || !klass?.id || klass.is_active === false) return null;
  return {
    studentId: row.student_id,
    student,
    classId: row.class_id,
    klass,
  };
}

function gradeFromClass(klass: NonNullable<ClassEmbed>): {
  id: string;
  name: string;
  sortOrder: number;
} {
  const gl = first(klass.grade_levels);
  return {
    id: gl?.id ?? "",
    name: gl?.name?.trim() || "—",
    sortOrder: typeof gl?.sort_order === "number" ? gl.sort_order : 0,
  };
}

function transitionStatusForStudent(
  rows: { student_id: string; status: string }[],
  studentId: string,
): TransitionNoteReviewStatus {
  const mine = rows.filter((r) => r.student_id === studentId);
  if (mine.length === 0) return "missing";
  if (mine.some((r) => r.status === "submitted")) return "submitted";
  return "draft";
}

function missingReportTerms(
  studentId: string,
  covered: Set<string>,
): readonly string[] {
  return REPORT_CARD_TERMS.filter((t) => !covered.has(`${studentId}|${t}`));
}

function parseSort(raw: string | undefined): AcademicReviewSearchParams["sort"] {
  if (raw === "class" || raw === "teacher" || raw === "grade") return raw;
  return "student";
}

export const loadAcademicReviewData = cache(
  async (
    search: AcademicReviewSearchParams,
  ): Promise<AcademicReviewResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();

    const { data: schoolYear, error: yearError } = await supabase
      .from("school_years")
      .select("id, label")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (yearError) {
      return { ok: false, message: yearError.message };
    }
    if (!schoolYear?.id || !schoolYear.label?.trim()) {
      return {
        ok: true,
        dbError: "No school year is configured yet.",
        summary: {
          schoolYearLabel: "—",
          schoolYearId: "",
          activeEnrollmentCount: 0,
          uniqueStudentCount: 0,
          transitionSubmittedCount: 0,
          transitionSubmittedPct: 0,
          transitionDraftCount: 0,
          transitionMissingCount: 0,
          reportExpectedSlots: 0,
          reportFilledSlots: 0,
          reportFilledPct: 0,
          studentsWithAllReportTerms: 0,
          reportAllTermsPct: 0,
          needsAttentionStudentCount: 0,
          academicRecordDraftCount: 0,
          academicRecordSubmittedCount: 0,
          academicRecordReviewedCount: 0,
          academicRecordArchivedCount: 0,
          academicRecordTotalCount: 0,
        },
        filterOptions: { grades: [], classes: [], teachers: [] },
        rows: [],
      };
    }

    const schoolYearId = schoolYear.id;
    const schoolYearLabel = schoolYear.label.trim();
    let dbError: string | null = null;

    const { data: enrollmentRows, error: enrError } = await supabase
      .from("student_enrollments")
      .select(
        `
        student_id,
        class_id,
        students!inner (
          id,
          first_name,
          last_name,
          preferred_name
        ),
        classes!inner (
          id,
          name,
          section,
          is_active,
          grade_levels ( id, name, sort_order ),
          class_teachers ( teacher_profile_id, role )
        )
      `,
      )
      .eq("status", "active")
      .eq("school_year_id", schoolYearId)
      .limit(2500);

    if (enrError) {
      return { ok: false, message: enrError.message };
    }

    const normalized = (enrollmentRows ?? [])
      .map((r) => normalizeEnrollment(r as unknown as EnrollmentRow))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const studentIds = [...new Set(normalized.map((n) => n.studentId))];
    const studentIdSet = new Set(studentIds);

    let transitionRows: { student_id: string; status: string }[] = [];
    if (studentIds.length > 0) {
      const { data: tnData, error: tnError } = await supabase
        .from("transition_notes")
        .select("student_id, status")
        .eq("school_year_id", schoolYearId)
        .in("student_id", studentIds);

      if (tnError) {
        return { ok: false, message: tnError.message };
      }
      transitionRows = (tnData ?? []) as { student_id: string; status: string }[];
    }

    const reportCoverage = new Set<string>();
    if (studentIds.length > 0) {
      const { data: files, error: filesError } = await supabase
        .from("report_card_files")
        .select("student_id, term")
        .eq("school_year", schoolYearLabel)
        .in("student_id", studentIds);

      if (filesError) {
        return { ok: false, message: filesError.message };
      }
      for (const row of files ?? []) {
        const sid = row.student_id as string;
        const term = String(row.term ?? "").trim();
        if (
          studentIdSet.has(sid) &&
          (REPORT_CARD_TERMS as readonly string[]).includes(term)
        ) {
          reportCoverage.add(`${sid}|${term}`);
        }
      }
    }

    const teacherIds = new Set<string>();
    const gradeMap = new Map<string, { id: string; name: string; sortOrder: number }>();
    const classMap = new Map<string, string>();

    const baseRows: AcademicReviewRow[] = [];

    for (const n of normalized) {
      const { studentId, student, classId, klass } = n;
      const grade = gradeFromClass(klass);
      if (grade.id) {
        gradeMap.set(grade.id, {
          id: grade.id,
          name: grade.name,
          sortOrder: grade.sortOrder,
        });
      }
      classMap.set(classId, classLabel(klass));

      const homeroomTeacherId = pickHomeroomTeacherId(klass.class_teachers);
      if (homeroomTeacherId) teacherIds.add(homeroomTeacherId);

      const tnStatus = transitionStatusForStudent(transitionRows, studentId);
      const missingTerms = missingReportTerms(studentId, reportCoverage);
      const satisfied = REPORT_CARD_TERMS.length - missingTerms.length;
      const needsAttention =
        tnStatus !== "submitted" || missingTerms.length > 0;

      baseRows.push({
        key: `${studentId}:${classId}`,
        studentId,
        studentDisplayName: displayStudentName(student),
        classId,
        classLabel: classLabel(klass),
        gradeLevelId: grade.id,
        gradeLevelName: grade.name,
        gradeSortOrder: grade.sortOrder,
        homeroomTeacherId,
        homeroomTeacherLabel: homeroomTeacherId
          ? staffLabel(homeroomTeacherId)
          : "—",
        transitionNoteStatus: tnStatus,
        missingReportCardTerms: missingTerms,
        reportCardTermsSatisfied: satisfied,
        studentNeedsAttention: needsAttention,
      });
    }

    const uniqueStudentCount = studentIds.length;
    const activeEnrollmentCount = baseRows.length;

    let transitionSubmittedCount = 0;
    let transitionDraftCount = 0;
    let transitionMissingCount = 0;
    for (const sid of studentIds) {
      const st = transitionStatusForStudent(transitionRows, sid);
      if (st === "submitted") transitionSubmittedCount += 1;
      else if (st === "draft") transitionDraftCount += 1;
      else transitionMissingCount += 1;
    }

    const transitionSubmittedPct =
      uniqueStudentCount > 0
        ? Math.round((transitionSubmittedCount / uniqueStudentCount) * 1000) / 10
        : 0;

    const reportExpectedSlots = uniqueStudentCount * REPORT_CARD_TERMS.length;
    let reportFilledSlots = 0;
    let studentsWithAllReportTerms = 0;
    for (const sid of studentIds) {
      let filled = 0;
      for (const t of REPORT_CARD_TERMS) {
        if (reportCoverage.has(`${sid}|${t}`)) {
          filled += 1;
          reportFilledSlots += 1;
        }
      }
      if (filled === REPORT_CARD_TERMS.length) studentsWithAllReportTerms += 1;
    }

    const reportFilledPct =
      reportExpectedSlots > 0
        ? Math.round((reportFilledSlots / reportExpectedSlots) * 1000) / 10
        : 0;

    const reportAllTermsPct =
      uniqueStudentCount > 0
        ? Math.round((studentsWithAllReportTerms / uniqueStudentCount) * 1000) / 10
        : 0;

    let needsAttentionStudentCount = 0;
    for (const sid of studentIds) {
      const tn = transitionStatusForStudent(transitionRows, sid);
      const missing = missingReportTerms(sid, reportCoverage);
      if (tn !== "submitted" || missing.length > 0) {
        needsAttentionStudentCount += 1;
      }
    }

    let academicRecordDraftCount = 0;
    let academicRecordSubmittedCount = 0;
    let academicRecordReviewedCount = 0;
    let academicRecordArchivedCount = 0;

    const { data: arData, error: arError } = await supabase
      .from("academic_records")
      .select("status")
      .eq("school_year_id", schoolYearId);

    if (arError) {
      dbError = dbError
        ? `${dbError} Academic records: ${arError.message}`
        : `Academic records: ${arError.message}`;
    } else {
      for (const row of arData ?? []) {
        const st = String(row.status ?? "");
        if (st === "draft") academicRecordDraftCount += 1;
        else if (st === "submitted") academicRecordSubmittedCount += 1;
        else if (st === "reviewed") academicRecordReviewedCount += 1;
        else if (st === "archived") academicRecordArchivedCount += 1;
      }
    }

    const academicRecordTotalCount =
      academicRecordDraftCount +
      academicRecordSubmittedCount +
      academicRecordReviewedCount +
      academicRecordArchivedCount;

    const filterOptions: AcademicReviewFilterOptions = {
      grades: [...gradeMap.values()].sort((a, b) => a.sortOrder - b.sortOrder),
      classes: [...classMap.entries()]
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      teachers: [...teacherIds]
        .sort()
        .map((id) => ({ id, label: staffLabel(id) })),
    };

    let filtered = [...baseRows];

    if (search.gradeId) {
      filtered = filtered.filter((r) => r.gradeLevelId === search.gradeId);
    }
    if (search.classId) {
      filtered = filtered.filter((r) => r.classId === search.classId);
    }
    if (search.teacherId) {
      filtered = filtered.filter((r) => r.homeroomTeacherId === search.teacherId);
    }

    const tn = search.tn ?? "all";
    if (tn === "submitted") {
      filtered = filtered.filter((r) => r.transitionNoteStatus === "submitted");
    } else if (tn === "draft") {
      filtered = filtered.filter((r) => r.transitionNoteStatus === "draft");
    } else if (tn === "missing") {
      filtered = filtered.filter((r) => r.transitionNoteStatus === "missing");
    } else if (tn === "incomplete") {
      filtered = filtered.filter((r) => r.transitionNoteStatus !== "submitted");
    }

    const rc = search.rc ?? "all";
    if (rc === "complete") {
      filtered = filtered.filter((r) => r.missingReportCardTerms.length === 0);
    } else if (rc === "incomplete") {
      filtered = filtered.filter((r) => r.missingReportCardTerms.length > 0);
    }

    const sortKey = search.sort;
    filtered.sort((a, b) => {
      if (sortKey === "class") {
        return a.classLabel.localeCompare(b.classLabel) || a.studentDisplayName.localeCompare(b.studentDisplayName);
      }
      if (sortKey === "teacher") {
        return (
          a.homeroomTeacherLabel.localeCompare(b.homeroomTeacherLabel) ||
          a.studentDisplayName.localeCompare(b.studentDisplayName)
        );
      }
      if (sortKey === "grade") {
        return (
          a.gradeSortOrder - b.gradeSortOrder ||
          a.studentDisplayName.localeCompare(b.studentDisplayName)
        );
      }
      return (
        a.studentDisplayName.localeCompare(b.studentDisplayName) ||
        a.classLabel.localeCompare(b.classLabel)
      );
    });

    return {
      ok: true,
      dbError,
      summary: {
        schoolYearLabel,
        schoolYearId,
        activeEnrollmentCount,
        uniqueStudentCount,
        transitionSubmittedCount,
        transitionSubmittedPct,
        transitionDraftCount,
        transitionMissingCount,
        reportExpectedSlots,
        reportFilledSlots,
        reportFilledPct,
        studentsWithAllReportTerms,
        reportAllTermsPct,
        needsAttentionStudentCount,
        academicRecordDraftCount,
        academicRecordSubmittedCount,
        academicRecordReviewedCount,
        academicRecordArchivedCount,
        academicRecordTotalCount,
      },
      filterOptions,
      rows: filtered,
    };
  },
);

export function parseAcademicReviewSearchParams(
  raw: Record<string, string | string[] | undefined>,
): AcademicReviewSearchParams {
  const one = (k: string): string | null => {
    const v = raw[k];
    if (typeof v === "string") {
      const t = v.trim();
      return t ? t : null;
    }
    if (Array.isArray(v) && typeof v[0] === "string") {
      const t = v[0].trim();
      return t ? t : null;
    }
    return null;
  };

  return {
    gradeId: one("grade"),
    classId: one("class"),
    teacherId: one("teacher"),
    tn: one("tn"),
    rc: one("rc"),
    sort: parseSort(one("sort") ?? undefined),
  };
}
