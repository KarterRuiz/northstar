import "server-only";

import { cache } from "react";

import type {
  StaffClassAssignmentRow,
  StaffGradeAccessRow,
  StaffMemberRow,
} from "@/features/admin/staff-directory/staff-directory-queries";
import {
  todayIso,
  weekRangeContaining,
  weekdaysInWeek,
} from "@/features/attendance/attendance-date-utils";
import { formatClassTeacherRoleForDisplay } from "@/features/classes/constants";
import { loadStaffProfileAssignments } from "@/features/staff-profile/load-staff-profile";
import { loadCurrentSchoolYear } from "@/lib/school-years/current-school-year";
import { isUuid } from "@/lib/students/uuid";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffAttentionItem = {
  id: string;
  label: string;
  href?: string;
};

export type StaffClassAcademicRow = {
  classId: string;
  className: string;
  section: string | null;
  schoolYearLabel: string;
  gradeName: string;
  assignmentRole: string;
  assignmentRoleLabel: string;
  classIsActive: boolean;
  studentCount: number;
  attendanceSubmittedToday: boolean | null;
  /** Leadership-safe links (do not broaden teacher gradebook write access). */
  classHref: string;
  reportCardsHref: string;
  attendanceHref: string;
};

export type StaffTransitionNoteRow = {
  id: string;
  studentId: string;
  studentName: string;
  classLabel: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  studentHref: string;
  noteHref: string;
};

export type StaffReportCardCompletion = {
  /** Accurate only when reportingStarted && coverageKnown. */
  available: boolean;
  reportingStarted: boolean;
  coverageKnown: boolean;
  schoolYearLabel: string | null;
  completedTermCodes: string[];
  completeCount: number;
  remainingCount: number;
  totalStudents: number;
  /** Narrative comments authored by this teacher's linked profile (when present). */
  commentsComplete: number | null;
  commentsDraft: number | null;
};

export type StaffClassAttendanceResponsibility = {
  classId: string;
  classLabel: string;
  studentCount: number;
  markedCount: number;
  submitted: boolean;
  /**
   * Best-available signal when submitted: max(updated_at) across today's
   * attendance_records for the class. Not a dedicated "submit" timestamp.
   */
  lastMarkedAt: string | null;
  attendanceHref: string;
};

export type StaffAttendanceCompliance = {
  classesExpectedToday: number;
  classesSubmittedToday: number;
  missingCount: number;
  missingClassLabels: string[];
  /** null when no class×day slots to evaluate this week. */
  weeklyCompletionPct: number | null;
  weeklySubmittedSlots: number;
  weeklyExpectedSlots: number;
  attendanceWorkspaceHref: string;
};

export type StaffLeadershipMetrics = {
  grades: StaffGradeAccessRow[];
  classes: StaffClassAssignmentRow[];
  classAcademics: StaffClassAcademicRow[];
  classAttendance: StaffClassAttendanceResponsibility[];
  attendanceCompliance: StaffAttendanceCompliance;
  missingClassAttendanceCount: number;
  transitionNotes: StaffTransitionNoteRow[];
  transitionCompleted: number;
  transitionPendingReview: number;
  reportCards: StaffReportCardCompletion;
  attentionItems: StaffAttentionItem[];
};

function classLabel(name: string, section: string | null): string {
  const sec = section?.trim();
  return sec ? `${name} · ${sec}` : name;
}

function laterIso(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

export const loadStaffLeadershipMetrics = cache(
  async (
    staffMemberId: string,
    member: StaffMemberRow,
    viewerRole: string,
  ): Promise<StaffLeadershipMetrics> => {
    const emptyReport: StaffReportCardCompletion = {
      available: false,
      reportingStarted: false,
      coverageKnown: false,
      schoolYearLabel: null,
      completedTermCodes: [],
      completeCount: 0,
      remainingCount: 0,
      totalStudents: 0,
      commentsComplete: null,
      commentsDraft: null,
    };

    const emptyCompliance: StaffAttendanceCompliance = {
      classesExpectedToday: 0,
      classesSubmittedToday: 0,
      missingCount: 0,
      missingClassLabels: [],
      weeklyCompletionPct: null,
      weeklySubmittedSlots: 0,
      weeklyExpectedSlots: 0,
      attendanceWorkspaceHref: `/dashboard/${viewerRole}/attendance`,
    };

    const empty: StaffLeadershipMetrics = {
      grades: [],
      classes: [],
      classAcademics: [],
      classAttendance: [],
      attendanceCompliance: emptyCompliance,
      missingClassAttendanceCount: 0,
      transitionNotes: [],
      transitionCompleted: 0,
      transitionPendingReview: 0,
      reportCards: emptyReport,
      attentionItems: [],
    };

    if (!isUuid(staffMemberId) || !isSupabaseConfigured()) return empty;

    const { grades, classes } = await loadStaffProfileAssignments(staffMemberId);

    const classIds = classes.map((c) => c.classId);
    const supabase = await createServerSupabaseClient();
    const today = todayIso();
    const yearRes = await loadCurrentSchoolYear(supabase);
    const schoolYear = yearRes.ok ? yearRes.year : null;
    const week = weekRangeContaining(today);
    const weekDays = weekdaysInWeek(week.start).filter((d) => d <= today);

    const enrollmentByClass = new Map<string, Set<string>>();
    if (classIds.length > 0) {
      let enrollQuery = supabase
        .from("student_enrollments")
        .select("class_id, student_id")
        .in("class_id", classIds)
        .eq("status", "active");
      if (schoolYear?.id) {
        enrollQuery = enrollQuery.eq("school_year_id", schoolYear.id);
      }
      const { data: enrollments } = await enrollQuery;
      for (const row of enrollments ?? []) {
        const set = enrollmentByClass.get(row.class_id) ?? new Set();
        set.add(row.student_id);
        enrollmentByClass.set(row.class_id, set);
      }
    }

    const studentIds = [
      ...new Set([...enrollmentByClass.values()].flatMap((s) => [...s])),
    ];

    const schoolYearLabels = [
      ...new Set(
        classes.map((c) => c.schoolYearLabel.trim()).filter(Boolean),
      ),
    ];

    /** classId → date → studentIds marked */
    const markedByClassDate = new Map<string, Map<string, Set<string>>>();
    /** classId → date → latest updated_at/created_at */
    const lastMarkedByClassDate = new Map<string, Map<string, string>>();

    if (classIds.length > 0 && studentIds.length > 0 && weekDays.length > 0) {
      let attQuery = supabase
        .from("attendance_records")
        .select("class_id, student_id, attendance_date, created_at, updated_at")
        .gte("attendance_date", weekDays[0]!)
        .lte("attendance_date", today)
        .in("class_id", classIds);
      if (schoolYearLabels.length > 0) {
        attQuery = attQuery.in("school_year", schoolYearLabels);
      }
      const { data: weekMarks } = await attQuery;
      for (const row of weekMarks ?? []) {
        const dateMap =
          markedByClassDate.get(row.class_id) ?? new Map<string, Set<string>>();
        const set = dateMap.get(row.attendance_date) ?? new Set();
        set.add(row.student_id);
        dateMap.set(row.attendance_date, set);
        markedByClassDate.set(row.class_id, dateMap);

        const stamp = laterIso(row.updated_at, row.created_at);
        if (stamp) {
          const stampMap =
            lastMarkedByClassDate.get(row.class_id) ?? new Map<string, string>();
          stampMap.set(
            row.attendance_date,
            laterIso(stampMap.get(row.attendance_date), stamp) ?? stamp,
          );
          lastMarkedByClassDate.set(row.class_id, stampMap);
        }
      }
    }

    const markedByClassToday = new Map<string, Set<string>>();
    for (const [classId, dateMap] of markedByClassDate) {
      const todaySet = dateMap.get(today);
      if (todaySet) markedByClassToday.set(classId, todaySet);
    }

    const classAcademics: StaffClassAcademicRow[] = classes.map((c) => {
      const total = enrollmentByClass.get(c.classId)?.size ?? 0;
      const marked = markedByClassToday.get(c.classId)?.size ?? 0;
      const submitted = total > 0 ? marked >= total : null;
      return {
        classId: c.classId,
        className: c.className,
        section: c.section,
        schoolYearLabel: c.schoolYearLabel,
        gradeName: c.gradeName,
        assignmentRole: c.assignmentRole,
        assignmentRoleLabel: formatClassTeacherRoleForDisplay(c.assignmentRole),
        classIsActive: c.classIsActive,
        studentCount: total,
        attendanceSubmittedToday: submitted,
        classHref: `/dashboard/${viewerRole}/classes?q=${encodeURIComponent(c.className)}`,
        reportCardsHref: `/dashboard/${viewerRole}/report-cards?classId=${encodeURIComponent(c.classId)}`,
        attendanceHref: `/dashboard/${viewerRole}/attendance?classId=${encodeURIComponent(c.classId)}&status=${submitted === false ? "missing" : "all"}`,
      };
    });

    const classAttendance: StaffClassAttendanceResponsibility[] =
      classAcademics
        .filter((c) => c.classIsActive && c.studentCount > 0)
        .map((c) => {
          const submitted = c.attendanceSubmittedToday === true;
          return {
            classId: c.classId,
            classLabel: classLabel(c.className, c.section),
            studentCount: c.studentCount,
            markedCount: markedByClassToday.get(c.classId)?.size ?? 0,
            submitted,
            lastMarkedAt: submitted
              ? (lastMarkedByClassDate.get(c.classId)?.get(today) ?? null)
              : null,
            attendanceHref: c.attendanceHref,
          };
        });

    const missingClassAttendanceCount = classAttendance.filter(
      (c) => !c.submitted,
    ).length;

    let weeklyExpectedSlots = 0;
    let weeklySubmittedSlots = 0;
    for (const c of classAttendance) {
      const enrolled = enrollmentByClass.get(c.classId);
      const total = enrolled?.size ?? 0;
      if (total === 0) continue;
      for (const day of weekDays) {
        weeklyExpectedSlots += 1;
        const marked = markedByClassDate.get(c.classId)?.get(day)?.size ?? 0;
        if (marked >= total) weeklySubmittedSlots += 1;
      }
    }

    const attendanceCompliance: StaffAttendanceCompliance = {
      classesExpectedToday: classAttendance.length,
      classesSubmittedToday: classAttendance.filter((c) => c.submitted).length,
      missingCount: missingClassAttendanceCount,
      missingClassLabels: classAttendance
        .filter((c) => !c.submitted)
        .map((c) => c.classLabel),
      weeklyCompletionPct:
        weeklyExpectedSlots > 0
          ? Math.round((weeklySubmittedSlots / weeklyExpectedSlots) * 100)
          : null,
      weeklySubmittedSlots,
      weeklyExpectedSlots,
      attendanceWorkspaceHref: `/dashboard/${viewerRole}/attendance`,
    };

    // Transition notes authored by this teacher's linked profile.
    let transitionNotes: StaffTransitionNoteRow[] = [];
    let transitionCompleted = 0;
    let transitionPendingReview = 0;

    if (member.profile_id) {
      const { data: notes } = await supabase
        .from("transition_notes")
        .select("id, student_id, status, created_at, reviewed_at")
        .eq("author_profile_id", member.profile_id)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(40);

      const noteStudentIds = [
        ...new Set((notes ?? []).map((n) => n.student_id)),
      ];
      const studentNames = new Map<string, string>();
      const classByStudent = new Map<string, string>();

      if (noteStudentIds.length > 0) {
        const [{ data: students }, { data: enr }] = await Promise.all([
          supabase
            .from("students")
            .select("id, first_name, last_name, preferred_name")
            .in("id", noteStudentIds),
          supabase
            .from("student_enrollments")
            .select("student_id, class_id")
            .in("student_id", noteStudentIds)
            .eq("status", "active")
            .limit(200),
        ]);

        for (const s of students ?? []) {
          const preferred = s.preferred_name?.trim();
          studentNames.set(
            s.id,
            preferred ||
              [s.first_name, s.last_name].filter(Boolean).join(" ").trim() ||
              "Student",
          );
        }

        const enrollmentClassIds = [
          ...new Set((enr ?? []).map((e) => e.class_id)),
        ];
        const classNames = new Map<string, string>();
        if (enrollmentClassIds.length > 0) {
          const { data: clsRows } = await supabase
            .from("classes")
            .select("id, name, section")
            .in("id", enrollmentClassIds);
          for (const c of clsRows ?? []) {
            classNames.set(c.id, classLabel(c.name, c.section));
          }
        }
        for (const row of enr ?? []) {
          if (classByStudent.has(row.student_id)) continue;
          const label = classNames.get(row.class_id);
          if (label) classByStudent.set(row.student_id, label);
        }
      }

      transitionNotes = (notes ?? []).map((n) => {
        const status = String(n.status ?? "draft");
        if (status === "reviewed") transitionCompleted += 1;
        if (status === "submitted") transitionPendingReview += 1;
        return {
          id: n.id,
          studentId: n.student_id,
          studentName: studentNames.get(n.student_id) ?? "Student",
          classLabel: classByStudent.get(n.student_id) ?? null,
          status,
          createdAt: n.created_at,
          reviewedAt: n.reviewed_at,
          studentHref: `/dashboard/${viewerRole}/students/${n.student_id}/transition-notes`,
          noteHref: `/dashboard/${viewerRole}/students/${n.student_id}/transition-notes`,
        };
      });
    }

    // Report-card coverage for students in assigned classes (completed terms only).
    let reportCards = emptyReport;
    if (schoolYear && studentIds.length > 0) {
      const termsRes = await supabase
        .from("terms")
        .select("code, ends_on")
        .eq("school_year_id", schoolYear.id)
        .order("starts_on", { ascending: true });

      const completedTermCodes = (termsRes.data ?? [])
        .filter((t) => t.ends_on < today)
        .map((t) => t.code.trim())
        .filter(Boolean);

      if (completedTermCodes.length === 0) {
        reportCards = {
          ...emptyReport,
          available: true,
          reportingStarted: false,
          coverageKnown: true,
          schoolYearLabel: schoolYear.label,
          completedTermCodes: [],
          totalStudents: studentIds.length,
        };
      } else {
        const filesRes = await supabase
          .from("report_card_files")
          .select("student_id, term")
          .eq("school_year", schoolYear.label)
          .in("term", completedTermCodes)
          .in("student_id", studentIds)
          .is("voided_at", null);

        if (filesRes.error) {
          reportCards = {
            ...emptyReport,
            available: false,
            reportingStarted: true,
            coverageKnown: false,
            schoolYearLabel: schoolYear.label,
            completedTermCodes,
            totalStudents: studentIds.length,
          };
        } else {
          const coveredByTerm = new Map<string, Set<string>>();
          for (const code of completedTermCodes) {
            coveredByTerm.set(code, new Set());
          }
          for (const row of filesRes.data ?? []) {
            const term = String(row.term ?? "").trim();
            const set = coveredByTerm.get(term);
            if (set) set.add(row.student_id);
          }

          let remainingCount = 0;
          let completeCount = 0;
          for (const sid of studentIds) {
            const missingTerm = completedTermCodes.some(
              (code) => !coveredByTerm.get(code)?.has(sid),
            );
            if (missingTerm) remainingCount += 1;
            else completeCount += 1;
          }

          reportCards = {
            available: true,
            reportingStarted: true,
            coverageKnown: true,
            schoolYearLabel: schoolYear.label,
            completedTermCodes,
            completeCount,
            remainingCount,
            totalStudents: studentIds.length,
            commentsComplete: null,
            commentsDraft: null,
          };
        }
      }

      if (member.profile_id && schoolYear.id) {
        const { data: comments } = await supabase
          .from("report_card_comments")
          .select("status")
          .eq("teacher_profile_id", member.profile_id)
          .eq("school_year_id", schoolYear.id);
        if (comments) {
          let complete = 0;
          let draft = 0;
          for (const c of comments) {
            if (c.status === "complete") complete += 1;
            else draft += 1;
          }
          reportCards = {
            ...reportCards,
            commentsComplete: complete,
            commentsDraft: draft,
          };
        }
      }
    } else if (schoolYear) {
      reportCards = {
        ...emptyReport,
        available: true,
        reportingStarted: false,
        coverageKnown: true,
        schoolYearLabel: schoolYear.label,
        totalStudents: 0,
      };
    }

    const attentionItems: StaffAttentionItem[] = [];
    if (missingClassAttendanceCount > 0) {
      attentionItems.push({
        id: "class-attendance",
        label:
          missingClassAttendanceCount === 1
            ? "1 class still needs attendance today"
            : `${missingClassAttendanceCount} classes still need attendance today`,
        href: `/dashboard/${viewerRole}/teachers/${staffMemberId}/attendance`,
      });
    }
    if (
      reportCards.available &&
      reportCards.reportingStarted &&
      reportCards.coverageKnown &&
      reportCards.remainingCount > 0
    ) {
      attentionItems.push({
        id: "report-cards",
        label:
          reportCards.remainingCount === 1
            ? "1 report card remaining"
            : `${reportCards.remainingCount} report cards remaining`,
        href: `/dashboard/${viewerRole}/teachers/${staffMemberId}/student-records`,
      });
    }
    if (transitionPendingReview > 0) {
      attentionItems.push({
        id: "transition-review",
        label:
          transitionPendingReview === 1
            ? "1 transition note awaiting review"
            : `${transitionPendingReview} transition notes awaiting review`,
        href: `/dashboard/${viewerRole}/teachers/${staffMemberId}/student-records`,
      });
    }
    if (
      member.displayStatus === "invitation_sent" ||
      member.displayStatus === "opened" ||
      member.displayStatus === "ready" ||
      member.displayStatus === "draft"
    ) {
      if (!member.profile_id) {
        attentionItems.push({
          id: "invite",
          label:
            member.displayStatus === "draft" || member.displayStatus === "ready"
              ? "Invitation not sent"
              : "Invitation not accepted",
          href: `/dashboard/${viewerRole}/teachers/${staffMemberId}/overview`,
        });
      }
    }

    return {
      grades,
      classes,
      classAcademics,
      classAttendance,
      attendanceCompliance,
      missingClassAttendanceCount,
      transitionNotes,
      transitionCompleted,
      transitionPendingReview,
      reportCards,
      attentionItems,
    };
  },
);
