"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";
import type {
  StaffAttendanceCompliance,
  StaffClassAttendanceResponsibility,
} from "@/features/staff-profile/load-staff-leadership-metrics";
import { formatAttendanceTodaySummary } from "@/features/staff-profile/operations-summary";
import { AlertTriangle, ClipboardCheck } from "lucide-react";

type StaffAttendanceTabProps = {
  classAttendance: StaffClassAttendanceResponsibility[];
  compliance: StaffAttendanceCompliance;
};

function formatMarkedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StaffAttendanceTab({
  classAttendance,
  compliance,
}: StaffAttendanceTabProps) {
  const missing = classAttendance.filter((c) => !c.submitted);

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl space-y-1">
            <h2 className="ns-section-title">Attendance Compliance</h2>
            <p className="ns-muted">
              Whether this teacher&apos;s classes have student attendance submitted —
              not personal staff presence.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={compliance.attendanceWorkspaceHref}>
              Open attendance workspace
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card variant="metric">
            <CardHeader className="pb-2">
              <CardDescription>Today&apos;s classes</CardDescription>
              <CardTitle className="text-xl">
                {formatAttendanceTodaySummary(compliance)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card variant="metric">
            <CardHeader className="pb-2">
              <CardDescription>Submitted today</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {compliance.classesExpectedToday === 0
                  ? "—"
                  : `${compliance.classesSubmittedToday} / ${compliance.classesExpectedToday}`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card variant="metric">
            <CardHeader className="pb-2">
              <CardDescription>Weekly completion</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {compliance.weeklyCompletionPct == null
                  ? "—"
                  : `${compliance.weeklyCompletionPct}%`}
              </CardTitle>
            </CardHeader>
            {compliance.weeklyExpectedSlots > 0 ? (
              <CardContent className="pt-0">
                <p className="ns-meta">
                  {compliance.weeklySubmittedSlots} of{" "}
                  {compliance.weeklyExpectedSlots} class days this week
                </p>
              </CardContent>
            ) : null}
          </Card>
        </div>

        {missing.length > 0 ? (
          <Card variant="muted">
            <CardHeader>
              <CardTitle className="ns-card-title flex items-center gap-2">
                <AlertTriangle
                  className="size-4 shrink-0 text-amber-700 dark:text-amber-300"
                  aria-hidden
                />
                Missing attendance
              </CardTitle>
              <CardDescription>
                Classes that still need a full roster marked for today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {missing.map((row) => (
                  <li
                    key={row.classId}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-foreground font-medium">
                      {row.classLabel}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {row.markedCount} / {row.studentCount} marked
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {classAttendance.length === 0 ? (
          <ProfileEmptyState
            icon={ClipboardCheck}
            title="No class attendance to track"
            description="When this teacher has active classes with enrolled students, today’s submission status appears here."
          />
        ) : (
          <Card variant="table">
            <CardHeader>
              <CardTitle className="ns-card-title">Classes today</CardTitle>
              <CardDescription>
                Last marked time is the latest attendance_records update for that
                class today — not a dedicated submit timestamp.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Marked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last marked</TableHead>
                    <TableHead>Workspace</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classAttendance.map((row) => (
                    <TableRow key={row.classId}>
                      <TableCell className="ns-table-primary">
                        {row.classLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.markedCount} / {row.studentCount}
                      </TableCell>
                      <TableCell>
                        {row.submitted ? (
                          <span className="text-foreground text-sm font-medium">
                            Submitted
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Missing
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatMarkedAt(row.lastMarkedAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={row.attendanceHref}
                          className="text-primary text-sm font-medium hover:underline"
                        >
                          Open attendance
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
