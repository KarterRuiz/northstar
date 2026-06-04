import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, Users } from "lucide-react";

import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { cn } from "@/lib/utils";

import {
  ATTENDANCE_STICKY_TABLE_HEAD,
  ATTENDANCE_TABLE_SCROLL,
  ATTENDANCE_TABLE_STICKY,
} from "./attendance-table-sticky";

export { ATTENDANCE_STICKY_TABLE_HEAD, ATTENDANCE_TABLE_STICKY } from "./attendance-table-sticky";

type AttendanceStickyTableProps = {
  ariaLabel: string;
  minWidth?: string;
  children: ReactNode;
};

export function AttendanceStickyTable({
  ariaLabel,
  minWidth = "36rem",
  children,
}: AttendanceStickyTableProps) {
  return (
    <div className="border-border/70 overflow-hidden rounded-lg border">
      <div
        className={ATTENDANCE_TABLE_SCROLL}
        role="region"
        aria-label={ariaLabel}
      >
        <div className="w-full" style={{ minWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function attendanceStudentHeadClassName() {
  return cn(
    ATTENDANCE_STICKY_TABLE_HEAD,
    ATTENDANCE_TABLE_STICKY.studentHead,
    ATTENDANCE_TABLE_STICKY.edgeLeft,
  );
}

export function attendanceStudentCellClassName() {
  return cn(
    "font-medium",
    ATTENDANCE_TABLE_STICKY.studentCell,
    ATTENDANCE_TABLE_STICKY.edgeLeft,
  );
}

export function attendanceStickyHeadClassName(extra?: string) {
  return cn(ATTENDANCE_STICKY_TABLE_HEAD, "whitespace-nowrap", extra);
}

type ClassRosterEmptyProps = {
  hasClasses: boolean;
  classId: string | null;
  context: "weekly" | "monthly";
};

export function AttendanceClassRosterEmpty({
  hasClasses,
  classId,
  context,
}: ClassRosterEmptyProps) {
  if (!hasClasses) {
    return (
      <ListEmptyState
        className="m-6"
        icon={Users}
        title="No classes assigned"
        description="When you are assigned to teach a class, weekly and monthly attendance summaries appear here."
      />
    );
  }

  if (!classId) {
    return (
      <ListEmptyState
        className="m-6"
        icon={Users}
        title="Select a class"
        description={`Choose a class above to see ${context === "weekly" ? "weekly" : "monthly"} attendance for enrolled students.`}
      />
    );
  }

  return (
    <ListEmptyState
      className="m-6"
      icon={Users}
      title="No students in this class"
      description="Active enrollments appear here once students are on the class roster."
    />
  );
}

type WeekGridEmptyProps = {
  hasClasses: boolean;
  classId: string | null;
  weekLabel: string;
};

export function AttendanceWeekGridEmpty({
  hasClasses,
  classId,
  weekLabel,
}: WeekGridEmptyProps) {
  if (!hasClasses) {
    return (
      <ListEmptyState
        className="m-6"
        icon={CalendarDays}
        title="No classes assigned"
        description="When you are assigned to teach a class, the day-by-day week grid appears here."
      />
    );
  }

  if (!classId) {
    return (
      <ListEmptyState
        className="m-6"
        icon={CalendarDays}
        title="Select a class"
        description="Choose a class above to see each school day’s attendance marks for the selected week."
      />
    );
  }

  return (
    <ListEmptyState
      className="m-6"
      icon={CalendarDays}
      title="No students to show"
      description={`No enrolled students for this class during ${weekLabel}. Mark daily attendance on the Today tab to fill in the week grid.`}
    />
  );
}

export function AttendanceConcernsEmpty() {
  return (
    <ListEmptyState
      className="m-6"
      icon={AlertTriangle}
      title="No attendance concerns right now"
      description="Students appear here when they reach term thresholds (3+ absences or 5+ tardies) or 2+ absences in the current week. Keep marking daily attendance to keep flags up to date."
    />
  );
}
