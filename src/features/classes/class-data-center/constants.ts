import type { Role } from "@/config/roles";
import { academicReviewHref } from "@/features/academic-review/academic-review-href";
import { staffProfilePath } from "@/features/admin/staff-directory/staff-directory-path";

export const CLASS_DATA_CENTER_TAB_IDS = [
  "overview",
  "students",
  "attendance",
  "academics",
  "support",
  "records",
  "staff",
] as const;

export type ClassDataCenterTabId = (typeof CLASS_DATA_CENTER_TAB_IDS)[number];

export const CLASS_DATA_CENTER_TAB_LABELS: Record<ClassDataCenterTabId, string> = {
  overview: "Overview",
  students: "Students",
  attendance: "Attendance",
  academics: "Academics",
  support: "Behavior & Support",
  records: "Records",
  staff: "Staff",
};

const TAB_ID_SET = new Set<string>(CLASS_DATA_CENTER_TAB_IDS);

export function isClassDataCenterTabId(value: string): value is ClassDataCenterTabId {
  return TAB_ID_SET.has(value);
}

export function classDataCenterPath(
  role: Role,
  classId: string,
  tab: ClassDataCenterTabId = "overview",
): string {
  return `/dashboard/${role}/classes/${classId}/${tab}`;
}

export function classDataCenterRecordsViewHref(
  role: Role,
  classId: string,
  view: "report-cards" | "transition-notes",
): string {
  return `${classDataCenterPath(role, classId, "records")}?view=${view}`;
}

export function classDataCenterStudentProfileHref(role: Role, studentId: string): string {
  return `/dashboard/${role}/students/${studentId}/overview`;
}

export function classDataCenterStudentInterventionsHref(
  role: Role,
  studentId: string,
): string {
  return `/dashboard/${role}/students/${studentId}/interventions`;
}

export function classDataCenterStudentReportCardsHref(
  role: Role,
  studentId: string,
): string {
  return `/dashboard/${role}/students/${studentId}/report-cards`;
}

export function classDataCenterStaffProfileHref(
  role: Role,
  staffMemberId: string,
): string {
  return staffProfilePath(role, staffMemberId, "overview");
}

export function classDataCenterAcademicReviewHref(role: Role, classId: string): string {
  return academicReviewHref(role, {
    gradeId: null,
    classId,
    teacherId: null,
    tn: null,
    rc: null,
    sort: "student",
  });
}

/** Admin attendance command center; principals/VP stay in-class review. */
export function classDataCenterAttendanceWorkspaceHref(
  role: Role,
  classId: string,
  dateIso?: string,
): string | null {
  if (role !== "admin") return null;
  const p = new URLSearchParams();
  p.set("classId", classId);
  if (dateIso) p.set("date", dateIso);
  return `/dashboard/admin/attendance?${p.toString()}`;
}

/**
 * Opens Class Data Center → Students with the in-page Manage roster dialog.
 * Never points at Add student (`/students/new`) — that is `classDataCenterAddStudentHref`.
 */
export function classDataCenterManageRosterHref(role: Role, classId: string): string {
  return `${classDataCenterPath(role, classId, "students")}?manage=1`;
}

export function classDataCenterAddStudentHref(role: Role, classId: string): string {
  return `/dashboard/${role}/students/new?classId=${encodeURIComponent(classId)}`;
}

export function classDataCenterRosterImportHref(role: Role, classId?: string): string {
  if (classId) {
    return `/dashboard/${role}/students/import?classId=${encodeURIComponent(classId)}`;
  }
  return `/dashboard/${role}/students/import`;
}

export const CLASS_DATA_CENTER_CHECK_IN_LIMIT = 5;

/**
 * Per-tab read vs write classification (UI + server).
 * Write actions reuse existing leadership management surfaces only.
 */
export const CLASS_DATA_CENTER_TAB_PERMISSIONS = {
  overview: { read: true, write: false },
  students: { read: true, write: "enrollment_via_existing_admin_tools" },
  attendance: { read: true, write: false },
  academics: { read: true, write: false },
  support: { read: true, write: false },
  records: { read: true, write: false },
  staff: { read: true, write: "staffing_via_existing_admin_dialog" },
} as const;
