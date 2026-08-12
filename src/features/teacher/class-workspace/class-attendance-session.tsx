"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";
import { saveAttendanceBulkAction } from "@/features/attendance/actions";
import {
  attendanceStatusLabels,
  attendanceStatuses,
  type AttendanceStatus,
} from "@/features/attendance/schema";
import { formatSchoolHomeDate } from "@/features/calendar/school-timezone";
import { cn } from "@/lib/utils";

import {
  classAttendanceDateHref,
  classAttendanceTallyLine,
  CLASS_ATTENDANCE_STATUS_SHORT,
  defaultClassAttendanceDraft,
  tallyClassAttendance,
  type ClassAttendanceHistoryRow,
} from "./class-attendance";
import { classWorkspaceStudentProfileHref } from "./constants";
import type { ClassAttendanceRosterRow } from "./load-teacher-class-attendance";

type DraftRow = ClassAttendanceRosterRow & {
  draftStatus: AttendanceStatus;
  draftNotes: string;
};

function toDraftRows(roster: ClassAttendanceRosterRow[]): DraftRow[] {
  return roster.map((row) => ({
    ...row,
    draftStatus: defaultClassAttendanceDraft(row.status),
    draftNotes: row.notes ?? "",
  }));
}

export function ClassAttendanceSession({
  classId,
  schoolYearLabel,
  attendanceDate,
  studentCountLabel,
  completionLabel,
  roster,
  history,
}: {
  classId: string;
  schoolYearLabel: string;
  attendanceDate: string;
  studentCountLabel: string;
  completionLabel: string;
  roster: ClassAttendanceRosterRow[];
  history: ClassAttendanceHistoryRow[];
}) {
  const router = useRouter();
  const { toast, showToast } = useWorkspaceToast();
  const [rows, setRows] = React.useState<DraftRow[]>(() => toDraftRows(roster));
  const [pending, setPending] = React.useState(false);

  const draftTally = tallyClassAttendance(
    rows.map((row) => ({ status: row.draftStatus })),
  );
  const tallyLine = classAttendanceTallyLine(draftTally);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId ? { ...row, draftStatus: status } : row,
      ),
    );
  }

  function setNotes(studentId: string, notes: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.studentId === studentId ? { ...row, draftNotes: notes } : row,
      ),
    );
  }

  async function handleSave() {
    if (!schoolYearLabel) {
      showToast("error", "This class is missing a school year, so attendance cannot be saved.");
      return;
    }
    if (rows.length === 0) {
      showToast("error", "No students are enrolled in this class.");
      return;
    }
    setPending(true);
    const result = await saveAttendanceBulkAction({
      classId,
      attendanceDate,
      schoolYear: schoolYearLabel,
      rows: rows.map((row) => ({
        studentId: row.studentId,
        status: row.draftStatus,
        notes: row.draftNotes.trim() || null,
      })),
    });
    setPending(false);
    if (!result.ok) {
      showToast("error", result.message);
      return;
    }
    showToast("success", "Attendance saved for this class.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-heading text-base font-semibold tracking-tight">Attendance</h2>
          <p className="text-heading text-sm font-medium">
            {formatSchoolHomeDate(attendanceDate)}
          </p>
          <p className="ns-meta">
            {studentCountLabel}
            {" · "}
            {completionLabel}
          </p>
          {tallyLine ? <p className="ns-body">{tallyLine}</p> : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="class-attendance-date" className="ns-meta block">
              Date
            </label>
            <Input
              id="class-attendance-date"
              type="date"
              value={attendanceDate}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                router.push(classAttendanceDateHref(classId, next));
              }}
              className="h-10 w-[11rem] lg:h-9"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 lg:min-h-8"
            onClick={() =>
              setRows((prev) =>
                prev.map((row) => ({ ...row, draftStatus: "present" })),
              )
            }
          >
            Mark all present
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-11 lg:min-h-8"
            onClick={handleSave}
            disabled={pending || rows.length === 0}
          >
            {pending ? "Saving…" : "Save Attendance"}
          </Button>
        </div>
      </div>

      <WorkspaceToast toast={toast} />

      {rows.length === 0 ? (
        <div className="bg-card border-border/80 rounded-xl border px-4 py-6 shadow-sm">
          <p className="ns-body text-muted-foreground">
            No students are enrolled in this class yet.
          </p>
        </div>
      ) : (
        <div className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
          <ul className="divide-border/70 divide-y" aria-label="Class attendance roster">
            {rows.map((row) => (
              <li key={row.studentId} className="px-3 py-2.5 sm:px-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 sm:w-44 sm:shrink-0">
                    <Link
                      href={classWorkspaceStudentProfileHref(row.studentId)}
                      className="text-heading block truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {row.displayName}
                    </Link>
                  </div>
                  <div
                    role="group"
                    aria-label={`Attendance for ${row.displayName}`}
                    className="flex flex-wrap gap-1"
                  >
                    {attendanceStatuses.map((status) => {
                      const active = row.draftStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          aria-pressed={active}
                          aria-label={attendanceStatusLabels[status]}
                          title={attendanceStatusLabels[status]}
                          onClick={() => setStatus(row.studentId, status)}
                          className={cn(
                            "focus-visible:ring-ring min-h-11 min-w-11 rounded-full px-2.5 text-xs font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:outline-none lg:min-h-8 lg:min-w-8",
                            active
                              ? "bg-heading text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-heading",
                          )}
                        >
                          <span className="sm:hidden">{CLASS_ATTENDANCE_STATUS_SHORT[status]}</span>
                          <span className="hidden sm:inline">
                            {attendanceStatusLabels[status]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    value={row.draftNotes}
                    onChange={(event) => setNotes(row.studentId, event.target.value)}
                    placeholder="Note"
                    aria-label={`Note for ${row.displayName}`}
                    className="h-10 sm:ml-auto sm:max-w-[14rem] lg:h-9"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.length > 0 ? (
        <section aria-labelledby="class-attendance-history-heading" className="space-y-2">
          <h3
            id="class-attendance-history-heading"
            className="text-heading text-sm font-semibold tracking-tight"
          >
            Recent attendance
          </h3>
          <ul className="ns-body space-y-1">
            {history.map((row) => (
              <li key={row.date}>
                <Link
                  href={classAttendanceDateHref(classId, row.date)}
                  className="hover:text-heading underline-offset-4 hover:underline"
                >
                  {row.dateLabel} — {row.statusLabel}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
