import "server-only";

import { cache } from "react";

import type { Role } from "@/config/roles";
import { fetchStaffDirectorySummary } from "@/features/admin/staff-directory/staff-directory-queries";
import { loadAdminAttendanceOverviewMetrics } from "@/features/attendance/admin/load-admin-attendance-overview";
import { loadFollowUpTodayCount } from "@/features/follow-up/load-follow-up-workspace";
import { GENERIC_INFORMATION_LOAD_ERROR } from "@/lib/errors/safe-user-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  attendanceSignalStatus,
  classesSignalStatus,
  enrollmentSignalStatus,
  queueSignalStatus,
  reportCardSignalStatus,
  staffOpsSignalStatus,
  type AdminSignalStatus,
} from "./admin-signal-status";
import type { AdminQuickAccessId } from "./constants";
import {
  getAdminDashboardStats,
  type AdminDashboardStats,
  type AdminReportCardSignal,
} from "./load-admin-dashboard-stats";

export type AdminBriefLine = {
  id: string;
  text: string;
  href?: string;
  /** Steady = calm positive; info = neutral context; follow_up = useful next step. */
  tone: "steady" | "info" | "follow_up";
};

export type AdminTodaysBrief = {
  headline: string;
  lines: AdminBriefLine[];
};

export type AdminQuickAccessCard = {
  id: AdminQuickAccessId;
  title: string;
  path: string;
  summary: string;
};

export type AdminPulseIndicator = {
  id: string;
  label: string;
  value: string;
  status: AdminSignalStatus;
  href: string;
};

export type AdminCommandCenterData = {
  brief: AdminTodaysBrief;
  quickAccess: AdminQuickAccessCard[];
  pulse: AdminPulseIndicator[];
  attendance: {
    absencesToday: number;
    classesNotSubmitted: number;
    studentsNeedingFollowUp: number;
    completionPct: number;
    teachersWithMissingAttendance: number;
    hasClassesExpectingAttendance: boolean;
    status: AdminSignalStatus;
  };
  stats: AdminDashboardStats;
  staff: {
    activeStaff: number;
    teachers: number;
    readyToInvite: number;
    pendingInvitations: number;
  };
  error: string | null;
};

function workspacePath(role: Role, path: string): string {
  return `/dashboard/${role}${path.startsWith("/") ? path : `/${path}`}`;
}

function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

function reportCardSummary(signal: AdminReportCardSignal): string {
  if (!signal.reportingStarted) return "Reporting not started";
  if (!signal.coverageKnown) return "Coverage unavailable";
  if (signal.missingCount === 0) return "Complete for ended terms";
  return `${signal.missingCount} ${plural(signal.missingCount, "student", "students")} missing`;
}

function attendanceSummary(args: {
  hasClassesExpectingAttendance: boolean;
  classesNotSubmitted: number;
  studentsNeedingFollowUp: number;
  completionPct: number;
}): string {
  if (!args.hasClassesExpectingAttendance) return "No classes yet";
  if (args.classesNotSubmitted === 0 && args.studentsNeedingFollowUp === 0) {
    return "All class attendance complete";
  }
  if (args.classesNotSubmitted > 0) {
    return `${args.classesNotSubmitted} ${plural(
      args.classesNotSubmitted,
      "class",
      "classes",
    )} incomplete`;
  }
  return `${args.studentsNeedingFollowUp} needing follow-up`;
}

function buildTodaysBrief(args: {
  role: Role;
  attendance: {
    hasClassesExpectingAttendance: boolean;
    classesNotSubmitted: number;
    studentsNeedingFollowUp: number;
    absencesToday: number;
  };
  followUpsToday: number;
}): AdminTodaysBrief {
  const { role, attendance, followUpsToday } = args;
  const lines: AdminBriefLine[] = [];

  const attendanceSteady =
    attendance.hasClassesExpectingAttendance &&
    attendance.classesNotSubmitted === 0 &&
    attendance.studentsNeedingFollowUp === 0;

  const followUpCount = followUpsToday;

  if (attendanceSteady) {
    lines.push({
      id: "attendance-steady",
      text: "All class attendance is complete for today.",
      href: workspacePath(role, "/attendance"),
      tone: "steady",
    });
  } else if (!attendance.hasClassesExpectingAttendance) {
    lines.push({
      id: "attendance-not-started",
      text: "Class attendance will appear once classes are set up.",
      href: workspacePath(role, "/classes"),
      tone: "info",
    });
  }

  if (
    attendance.hasClassesExpectingAttendance &&
    attendance.studentsNeedingFollowUp > 0
  ) {
    lines.push({
      id: "attendance-follow-up",
      text: `${attendance.studentsNeedingFollowUp} ${plural(
        attendance.studentsNeedingFollowUp,
        "student needs",
        "students need",
      )} attendance follow-up.`,
      href: workspacePath(role, "/attendance"),
      tone: "follow_up",
    });
  } else if (attendanceSteady && attendance.absencesToday > 0) {
    lines.push({
      id: "absences-today",
      text: `${attendance.absencesToday} ${plural(
        attendance.absencesToday,
        "absence",
        "absences",
      )} recorded today.`,
      href: workspacePath(role, "/attendance"),
      tone: "info",
    });
  }

  if (followUpsToday > 0) {
    lines.push({
      id: "follow-ups-today",
      text:
        followUpsToday === 1
          ? "1 follow-up today."
          : `${followUpsToday} follow-ups today.`,
      href: workspacePath(role, "/follow-up"),
      tone: "follow_up",
    });
  }

  // Keep the brief compact — a few lines max. Do not duplicate Follow-Up.
  const trimmed = lines.slice(0, 4);

  const headline =
    followUpCount === 0
      ? "Everything looks steady right now."
      : followUpCount === 1
        ? "1 item needs another look."
        : `${followUpCount} items need another look.`;

  return { headline, lines: trimmed };
}

function buildQuickAccess(args: {
  role: Role;
  attendance: {
    hasClassesExpectingAttendance: boolean;
    classesNotSubmitted: number;
    studentsNeedingFollowUp: number;
    completionPct: number;
  };
  stats: AdminDashboardStats;
  staff: { activeStaff: number };
}): AdminQuickAccessCard[] {
  const { role, attendance, stats, staff } = args;

  return [
    {
      id: "students",
      title: "Students",
      path: workspacePath(role, "/students"),
      summary:
        stats.activeStudentCount === 0
          ? "No active enrollments"
          : `${stats.activeStudentCount} active`,
    },
    {
      id: "staff",
      title: "Staff",
      path: workspacePath(role, "/teachers"),
      summary:
        staff.activeStaff === 0
          ? "No active staff yet"
          : `${staff.activeStaff} active`,
    },
    {
      id: "attendance",
      title: "Attendance",
      path: workspacePath(role, "/attendance"),
      summary: attendanceSummary(attendance),
    },
    {
      id: "classes",
      title: "Classes",
      path: workspacePath(role, "/classes"),
      summary:
        stats.activeClassCount === 0
          ? "No active classes"
          : `${stats.activeClassCount} active`,
    },
    {
      id: "report-cards",
      title: "Report cards",
      path: workspacePath(role, "/report-cards"),
      summary: reportCardSummary(stats.reportCardSignal),
    },
    {
      id: "follow-up",
      title: "Follow-Up",
      path: workspacePath(role, "/follow-up"),
      summary:
        stats.pendingTransitionNotesCount === 0 &&
        stats.pendingParentRequestsLast30Days === 0
          ? "Quiet for now"
          : "Open workspace",
    },
    {
      id: "parent-requests",
      title: "Parent requests",
      path: workspacePath(role, "/parent-requests"),
      summary:
        stats.pendingParentRequestsLast30Days === 0
          ? "Inbox clear"
          : `${stats.pendingParentRequestsLast30Days} open`,
    },
    {
      id: "academic-review",
      title: "Academic review",
      path: workspacePath(role, "/academic-review"),
      summary:
        stats.pendingTransitionNotesCount === 0
          ? "Open workspace"
          : `${stats.pendingTransitionNotesCount} to review`,
    },
  ];
}

function buildSchoolPulse(args: {
  role: Role;
  attendance: {
    hasClassesExpectingAttendance: boolean;
    classesNotSubmitted: number;
    studentsNeedingFollowUp: number;
  };
  stats: AdminDashboardStats;
  staff: {
    activeStaff: number;
    pendingInvitations: number;
    readyToInvite: number;
  };
}): AdminPulseIndicator[] {
  const { role, attendance, stats, staff } = args;

  const attendanceStatus = attendanceSignalStatus({
    classesNotSubmitted: attendance.classesNotSubmitted,
    studentsNeedingFollowUp: attendance.studentsNeedingFollowUp,
    hasClassesExpectingAttendance: attendance.hasClassesExpectingAttendance,
  });

  const attendanceValue = !attendance.hasClassesExpectingAttendance
    ? "Not started"
    : attendance.classesNotSubmitted === 0
      ? "Complete"
      : `${attendance.classesNotSubmitted} incomplete`;

  const reportStatus = reportCardSignalStatus({
    reportingStarted: stats.reportCardSignal.reportingStarted,
    missingCount: stats.reportCardSignal.missingCount,
    coverageKnown: stats.reportCardSignal.coverageKnown,
  });

  const reportValue = !stats.reportCardSignal.reportingStarted
    ? "Not started"
    : !stats.reportCardSignal.coverageKnown
      ? "—"
      : stats.reportCardSignal.missingCount === 0
        ? "On track"
        : `${stats.reportCardSignal.missingCount} missing`;

  return [
    {
      id: "students",
      label: "Students",
      value: String(stats.activeStudentCount),
      status: enrollmentSignalStatus(stats.activeStudentCount),
      href: workspacePath(role, "/students"),
    },
    {
      id: "staff",
      label: "Staff",
      value: String(staff.activeStaff),
      status: staffOpsSignalStatus({
        activeStaff: staff.activeStaff,
        pendingInvitations: staff.pendingInvitations,
        readyToInvite: staff.readyToInvite,
        // Class attendance only — do not surface personal staff presence.
        teachersWithMissingAttendance: 0,
      }),
      href: workspacePath(role, "/teachers"),
    },
    {
      id: "attendance",
      label: "Attendance",
      value: attendanceValue,
      status: attendanceStatus,
      href: workspacePath(role, "/attendance"),
    },
    {
      id: "classes",
      label: "Classes",
      value: String(stats.activeClassCount),
      status: classesSignalStatus(stats.activeClassCount),
      href: workspacePath(role, "/classes"),
    },
    {
      id: "requests",
      label: "Requests",
      value:
        stats.pendingParentRequestsLast30Days === 0
          ? "Clear"
          : String(stats.pendingParentRequestsLast30Days),
      status: queueSignalStatus(stats.pendingParentRequestsLast30Days),
      href: workspacePath(role, "/parent-requests"),
    },
    {
      id: "reports",
      label: "Reports",
      value: reportValue,
      status: reportStatus,
      href: workspacePath(role, "/report-cards"),
    },
  ];
}

/**
 * Aggregates Admin Home / command-center sections from existing cached loaders.
 * Prefer this over ad-hoc parallel fetches in multiple section components.
 */
export const loadAdminCommandCenter = cache(
  async (role: Role = "admin"): Promise<AdminCommandCenterData> => {
    if (!isSupabaseConfigured()) {
      const emptyAttendance = {
        absencesToday: 0,
        classesNotSubmitted: 0,
        studentsNeedingFollowUp: 0,
        completionPct: 0,
        teachersWithMissingAttendance: 0,
        hasClassesExpectingAttendance: false,
        status: "Not started" as const,
      };
      const stats = await getAdminDashboardStats();
      const staff = {
        activeStaff: 0,
        teachers: 0,
        readyToInvite: 0,
        pendingInvitations: 0,
      };
      return {
        brief: {
          headline: "School data is temporarily unavailable.",
          lines: [],
        },
        quickAccess: buildQuickAccess({
          role,
          attendance: emptyAttendance,
          stats,
          staff,
        }),
        pulse: buildSchoolPulse({
          role,
          attendance: emptyAttendance,
          stats,
          staff,
        }),
        attendance: emptyAttendance,
        stats,
        staff,
        error: GENERIC_INFORMATION_LOAD_ERROR,
      };
    }

    const [stats, attendance, staffSummary, followUpsToday] = await Promise.all([
      getAdminDashboardStats(),
      loadAdminAttendanceOverviewMetrics(),
      fetchStaffDirectorySummary(),
      loadFollowUpTodayCount(role),
    ]);

    const attendanceStatus = attendanceSignalStatus({
      classesNotSubmitted: attendance.classesNotSubmitted,
      studentsNeedingFollowUp: attendance.studentsNeedingFollowUp,
      hasClassesExpectingAttendance: attendance.hasClassesExpectingAttendance,
    });

    const staff = {
      activeStaff: staffSummary.activeStaff,
      teachers: staffSummary.teachers,
      readyToInvite: staffSummary.readyToInvite,
      pendingInvitations: staffSummary.pendingInvitations,
    };

    const error =
      stats.dbError || staffSummary.error
        ? GENERIC_INFORMATION_LOAD_ERROR
        : null;

    return {
      brief: buildTodaysBrief({ role, attendance, followUpsToday }),
      quickAccess: buildQuickAccess({ role, attendance, stats, staff }),
      pulse: buildSchoolPulse({ role, attendance, stats, staff }),
      attendance: {
        ...attendance,
        status: attendanceStatus,
      },
      stats,
      staff,
      error,
    };
  },
);

/** First name for greeting only when a real profile name is available. */
export const loadAdminOverviewGreetingName = cache(
  async (userId: string): Promise<string | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const full = data?.full_name?.trim();
    if (!full) return null;
    const first = full.split(/\s+/)[0]?.trim();
    return first || null;
  },
);
