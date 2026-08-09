import type { StaffAttendanceStatus } from "./constants";

/** Neutral leadership language — not student attendance labels. */
export const staffAttendanceStatusLabels: Record<StaffAttendanceStatus, string> =
  {
    present: "Present",
    absent: "Absent",
    late: "Late",
    approved_leave: "Approved leave",
    sick: "Sick",
    professional_development: "Professional development",
    off_campus: "Off campus",
    not_recorded: "Not recorded",
  };

export function staffAttendanceStatusLabel(
  status: StaffAttendanceStatus | null | undefined,
): string {
  if (!status) return "Not recorded";
  return staffAttendanceStatusLabels[status] ?? status;
}
