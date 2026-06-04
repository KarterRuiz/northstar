import type { AttendanceStatus } from "./schema";

export type AttendanceTally = {
  present: number;
  absent: number;
  tardy: number;
  excused: number;
  partial: number;
  marked: number;
  notesCount: number;
};

export function emptyTally(): AttendanceTally {
  return {
    present: 0,
    absent: 0,
    tardy: 0,
    excused: 0,
    partial: 0,
    marked: 0,
    notesCount: 0,
  };
}

export function tallyFromRecords(
  records: { status: string; notes?: string | null }[],
): AttendanceTally {
  const t = emptyTally();
  for (const row of records) {
    t.marked += 1;
    if (row.notes?.trim()) t.notesCount += 1;
    switch (row.status) {
      case "present":
        t.present += 1;
        break;
      case "absent":
        t.absent += 1;
        break;
      case "tardy":
        t.tardy += 1;
        break;
      case "excused":
        t.excused += 1;
        break;
      case "partial":
        t.partial += 1;
        break;
      default:
        break;
    }
  }
  return t;
}

/** Share of marked days counted as attended (present, tardy, partial, excused). */
export function attendancePercent(tally: AttendanceTally): number | null {
  if (tally.marked === 0) return null;
  const attended = tally.present + tally.tardy + tally.partial + tally.excused;
  return Math.round((attended / tally.marked) * 100);
}

export function statusCountsInRange(
  records: { attendanceDate: string; status: string }[],
  start: string,
  end: string,
): AttendanceTally {
  const filtered = records.filter(
    (r) => r.attendanceDate >= start && r.attendanceDate <= end,
  );
  return tallyFromRecords(filtered);
}

export function isAttendedStatus(status: AttendanceStatus | string): boolean {
  return (
    status === "present" ||
    status === "tardy" ||
    status === "partial" ||
    status === "excused"
  );
}
