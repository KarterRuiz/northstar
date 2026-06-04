"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";
import { siteConfig } from "@/config/site";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import { cn } from "@/lib/utils";

import { saveAttendanceBulkAction } from "./actions";
import type { AttendancePageStats, AttendanceRosterRow } from "./load-attendance-page-data";
import {
  attendanceStatusLabels,
  attendanceStatuses,
  type AttendanceStatus,
} from "./schema";

const BASE = "/dashboard/teacher/attendance";

type LocalRow = AttendanceRosterRow & {
  draftStatus: AttendanceStatus;
  draftNotes: string;
};

type AttendanceViewProps = {
  classes: { id: string; label: string; schoolYearLabel: string }[];
  classId: string | null;
  schoolYearLabel: string;
  attendanceDate: string;
  roster: AttendanceRosterRow[];
  stats: AttendancePageStats;
  /** When true, omits page chrome (used inside attendance tabs). */
  embedded?: boolean;
};

function toLocalRows(roster: AttendanceRosterRow[]): LocalRow[] {
  return roster.map((r) => ({
    ...r,
    draftStatus: r.status ?? "present",
    draftNotes: r.notes ?? "",
  }));
}

export function AttendanceView({
  classes,
  classId,
  schoolYearLabel,
  attendanceDate,
  roster,
  stats,
  embedded = false,
}: AttendanceViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast } = useWorkspaceToast();
  const selectedClassId = classId ?? "";
  const sessionKey = `${selectedClassId}:${attendanceDate}`;

  function pushQuery(next: { classId?: string; date?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.classId != null) {
      if (next.classId) params.set("classId", next.classId);
      else params.delete("classId");
    }
    if (next.date != null) params.set("date", next.date);
    const q = params.toString();
    router.push(q ? `${BASE}?${q}` : BASE);
  }

  const completionPct =
    stats.rosterTotal > 0
      ? Math.round((stats.markedToday / stats.rosterTotal) * 100)
      : 0;

  const content = (
    <>
      {!embedded ? (
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Attendance"
          description="Mark daily attendance quickly for your class roster. Changes save together for the whole class."
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's completion"
          value={`${completionPct}%`}
          hint={`${stats.markedToday} of ${stats.rosterTotal} marked`}
        />
        <StatCard label="Absences today" value={String(stats.absenceCount)} />
        <StatCard label="Tardies today" value={String(stats.tardyCount)} />
        <StatCard
          label="Repeated absences (term)"
          value={String(stats.repeatedAbsenceStudents.length)}
          hint="3+ absences this term"
        />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Session</CardTitle>
          <CardDescription>Choose class and date, then mark each student.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="attendance-class">Class</Label>
            <select
              id="attendance-class"
              className={selectClassName}
              value={selectedClassId}
              onChange={(e) => pushQuery({ classId: e.target.value })}
            >
              <option value="" disabled>
                Select class
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendance-date">Date</Label>
            <Input
              id="attendance-date"
              type="date"
              value={attendanceDate}
              onChange={(e) => pushQuery({ date: e.target.value })}
              className="w-[11rem]"
            />
          </div>
        </CardContent>
      </Card>

      {stats.repeatedAbsenceStudents.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Students with repeated absences</CardTitle>
            <CardDescription className="text-xs">
              Current term — consider a check-in or attendance intervention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2 text-sm">
              {stats.repeatedAbsenceStudents.map((s) => (
                <li key={s.studentId}>
                  <Link
                    href={`/dashboard/teacher/students/${s.studentId}/attendance`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {s.displayName}
                  </Link>
                  <span className="text-muted-foreground"> ({s.count})</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <AttendanceSessionEditor
        key={sessionKey}
        classId={selectedClassId}
        attendanceDate={attendanceDate}
        schoolYearLabel={schoolYearLabel}
        roster={roster}
        classesEmpty={classes.length === 0}
        onFeedback={showToast}
        onSaved={() => router.refresh()}
      />

      <WorkspaceToast toast={toast} />
    </>
  );

  if (embedded) {
    return <div className="space-y-6">{content}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">{content}</div>
  );
}

function AttendanceSessionEditor({
  classId,
  attendanceDate,
  schoolYearLabel,
  roster,
  classesEmpty,
  onFeedback,
  onSaved,
}: {
  classId: string;
  attendanceDate: string;
  schoolYearLabel: string;
  roster: AttendanceRosterRow[];
  classesEmpty: boolean;
  onFeedback: (kind: "success" | "error", message: string) => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = React.useState<LocalRow[]>(() => toLocalRows(roster));
  const [pending, setPending] = React.useState(false);

  async function handleSave() {
    if (!classId) {
      onFeedback("error", "Choose a class first.");
      return;
    }
    setPending(true);
    const result = await saveAttendanceBulkAction({
      classId,
      attendanceDate,
      schoolYear: schoolYearLabel,
      rows: rows.map((r) => ({
        studentId: r.studentId,
        status: r.draftStatus,
        notes: r.draftNotes.trim() || null,
      })),
    });
    setPending(false);
    if (!result.ok) {
      onFeedback("error", result.message);
      return;
    }
    onFeedback("success", "Attendance saved for this class and date.");
    onSaved();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setRows((prev) => prev.map((r) => ({ ...r, draftStatus: "present" as const })))
          }
        >
          Mark all present
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((prev) => prev.map((r) => ({ ...r, draftNotes: "" })))}
        >
          Clear notes
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={pending || !classId}>
          {pending ? "Saving…" : "Save all"}
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              {classesEmpty
                ? "No assigned classes yet."
                : "No active enrollments in this class."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[36rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[12rem]">Notes (optional)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/teacher/students/${row.studentId}/overview`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                        <p className="text-muted-foreground text-xs">{row.gradeName}</p>
                      </TableCell>
                      <TableCell>
                        <select
                          className={cn(selectClassName, "h-9 w-[9.5rem]")}
                          value={row.draftStatus}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.studentId === row.studentId
                                  ? {
                                      ...r,
                                      draftStatus: e.target.value as AttendanceStatus,
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          {attendanceStatuses.map((s) => (
                            <option key={s} value={s}>
                              {attendanceStatusLabels[s]}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={row.draftNotes}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.studentId === row.studentId
                                  ? { ...r, draftNotes: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          rows={1}
                          className="min-h-9 resize-y text-sm"
                          placeholder="Optional note"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-xs font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
