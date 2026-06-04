export type AttendanceTab = "daily" | "weekly" | "monthly" | "concerns";

export function parseAttendanceTab(value: string | null | undefined): AttendanceTab {
  if (value === "weekly" || value === "monthly" || value === "concerns") return value;
  return "daily";
}
