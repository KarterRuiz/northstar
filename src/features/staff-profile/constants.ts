export const STAFF_PROFILE_TAB_IDS = [
  "overview",
  "classes",
  "attendance",
  "student-records",
  "professional-notes",
  "files-activity",
] as const;

export type StaffProfileTabId = (typeof STAFF_PROFILE_TAB_IDS)[number];

/** Old profile segments → new primary sections (keep deep links working). */
export const STAFF_PROFILE_TAB_ALIASES: Record<string, StaffProfileTabId> = {
  assignment: "classes",
  "transition-notes": "student-records",
  observations: "professional-notes",
  growth: "professional-notes",
  files: "files-activity",
  activity: "files-activity",
};

export function isStaffProfileTabId(value: string): value is StaffProfileTabId {
  return (STAFF_PROFILE_TAB_IDS as readonly string[]).includes(value);
}

export function resolveStaffProfileTabId(value: string): StaffProfileTabId {
  if (isStaffProfileTabId(value)) return value;
  return STAFF_PROFILE_TAB_ALIASES[value] ?? "overview";
}

/** Staff attendance statuses — distinct from student attendance_records. */
export const STAFF_ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "approved_leave",
  "sick",
  "professional_development",
  "off_campus",
  "not_recorded",
] as const;

export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];

export function isStaffAttendanceStatus(
  value: string,
): value is StaffAttendanceStatus {
  return (STAFF_ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/** Exception statuses surfaced on Staff Today (not a full roster dump). */
export const STAFF_TODAY_EXCEPTION_STATUSES = [
  "absent",
  "late",
  "not_recorded",
] as const satisfies readonly StaffAttendanceStatus[];
