export const attendanceStatuses = [
  "present",
  "absent",
  "tardy",
  "excused",
  "partial",
] as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  tardy: "Tardy",
  excused: "Excused",
  partial: "Partial day",
};

export type AttendanceRowInput = {
  studentId: string;
  status: AttendanceStatus;
  notes?: string | null;
};

export type SaveAttendanceBulkInput = {
  classId: string;
  attendanceDate: string;
  schoolYear: string;
  rows: AttendanceRowInput[];
};
