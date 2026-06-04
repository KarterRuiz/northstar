"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AttendanceClassRosterEmpty,
  AttendanceStickyTable,
  attendanceStickyHeadClassName,
  attendanceStudentCellClassName,
  attendanceStudentHeadClassName,
} from "@/features/attendance/attendance-sticky-table";
import { AttendanceTrendBadge } from "@/features/attendance/attendance-trend-badge";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import { cn } from "@/lib/utils";

import type { MonthlyReviewData } from "./load-monthly-review-data";

const BASE = "/dashboard/teacher/attendance";

type MonthlyReviewPanelProps = Extract<MonthlyReviewData, { ok: true }>;

export function MonthlyReviewPanel(props: MonthlyReviewPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedClassId = props.classId ?? "";
  const hasClasses = props.classes.length > 0;

  function pushQuery(patch: { classId?: string; month?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "monthly");
    if (patch.classId != null) {
      if (patch.classId) params.set("classId", patch.classId);
      else params.delete("classId");
    }
    if (patch.month != null) params.set("month", patch.month);
    router.push(`${BASE}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Month</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{props.monthLabel}</span>
            {props.classId ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Class trend:</span>
                <AttendanceTrendBadge trend={props.summary.trend} />
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="monthly-class">Class</Label>
            <select
              id="monthly-class"
              className={selectClassName}
              value={selectedClassId}
              onChange={(e) => pushQuery({ classId: e.target.value })}
            >
              <option value="" disabled>
                Select class
              </option>
              {props.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly-picker">Month</Label>
            <Input
              id="monthly-picker"
              type="month"
              defaultValue={props.monthLabel}
              className="w-[11rem]"
              onChange={(e) => pushQuery({ month: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryStat label="Days marked" value={String(props.summary.daysMarked)} />
        <SummaryStat label="Absences" value={String(props.summary.absences)} />
        <SummaryStat label="Tardies" value={String(props.summary.tardies)} />
        <SummaryStat label="Excused" value={String(props.summary.excused)} />
        <SummaryStat
          label="Attendance %"
          value={
            props.summary.attendancePct != null ? `${props.summary.attendancePct}%` : "—"
          }
        />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Per-student summary</CardTitle>
          <CardDescription className="text-xs">
            Highlighted rows have repeated absences or tardies this month.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {props.students.length === 0 ? (
            <AttendanceClassRosterEmpty
              hasClasses={hasClasses}
              classId={props.classId}
              context="monthly"
            />
          ) : (
            <AttendanceStickyTable ariaLabel="Monthly per-student summary" minWidth="40rem">
              <table className="w-full min-w-[40rem] caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className={attendanceStudentHeadClassName()}>
                      Student
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      Days
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      Absent
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      Tardy
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      Excused
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      %
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName()}>
                      Trend
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName()}>
                      Follow-up
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.students.map((row) => (
                    <TableRow
                      key={row.studentId}
                      className={cn("group [&>td]:py-3", row.highlight && "bg-amber-500/5")}
                    >
                      <TableCell
                        className={cn(
                          attendanceStudentCellClassName(),
                          row.highlight && "bg-amber-500/5 group-hover:bg-amber-500/5",
                        )}
                      >
                        <Link
                          href={`/dashboard/teacher/students/${row.studentId}/attendance`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.daysMarked}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.absences}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.tardies}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.excused}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.attendancePct != null ? `${row.attendancePct}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <AttendanceTrendBadge trend={row.trend} />
                      </TableCell>
                      <TableCell>
                        {row.concernFollowUp ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            {row.concernFollowUp}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </AttendanceStickyTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-xs font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
