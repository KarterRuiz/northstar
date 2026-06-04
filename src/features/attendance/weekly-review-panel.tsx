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
import { weekdayShort } from "@/features/attendance/attendance-date-utils";
import { AttendanceTrendBadge } from "@/features/attendance/attendance-trend-badge";
import {
  AttendanceClassRosterEmpty,
  AttendanceStickyTable,
  AttendanceWeekGridEmpty,
  attendanceStickyHeadClassName,
  attendanceStudentCellClassName,
  attendanceStudentHeadClassName,
} from "@/features/attendance/attendance-sticky-table";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import { cn } from "@/lib/utils";

import type { WeeklyReviewData } from "./load-weekly-review-data";

const BASE = "/dashboard/teacher/attendance";

type WeeklyReviewPanelProps = Extract<WeeklyReviewData, { ok: true }>;

export function WeeklyReviewPanel(props: WeeklyReviewPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedClassId = props.classId ?? "";
  const hasClasses = props.classes.length > 0;
  const weekLabel = `${props.weekStart} — ${props.weekEnd}`;

  function pushQuery(patch: { classId?: string; week?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "weekly");
    if (patch.classId != null) {
      if (patch.classId) params.set("classId", patch.classId);
      else params.delete("classId");
    }
    if (patch.week != null) params.set("week", patch.week);
    router.push(`${BASE}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Week</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{weekLabel}</span>
            {props.classId ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Class trend:</span>
                <AttendanceTrendBadge trend={props.classTrend} />
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="weekly-class">Class</Label>
            <select
              id="weekly-class"
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
            <Label htmlFor="weekly-anchor">Week containing</Label>
            <Input
              id="weekly-anchor"
              type="date"
              defaultValue={props.weekStart}
              className="w-[11rem]"
              onChange={(e) => pushQuery({ week: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Roster summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {props.rosterSummary.length === 0 ? (
            <AttendanceClassRosterEmpty
              hasClasses={hasClasses}
              classId={props.classId}
              context="weekly"
            />
          ) : (
            <AttendanceStickyTable ariaLabel="Weekly roster summary" minWidth="44rem">
              <table className="w-full min-w-[44rem] caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className={attendanceStudentHeadClassName()}>
                      Student
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      Present
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
                    <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                      Notes
                    </TableHead>
                    <TableHead scope="col" className={attendanceStickyHeadClassName()}>
                      Follow-up
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.rosterSummary.map((row) => (
                    <TableRow key={row.studentId} className="group [&>td]:py-3">
                      <TableCell className={attendanceStudentCellClassName()}>
                        <Link
                          href={`/dashboard/teacher/students/${row.studentId}/attendance`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.present}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.absent}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.tardy}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.excused}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.attendancePct != null ? `${row.attendancePct}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <AttendanceTrendBadge trend={row.trend} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.notesCount}</TableCell>
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

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Week grid</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {props.weekGrid.length === 0 ? (
            <AttendanceWeekGridEmpty
              hasClasses={hasClasses}
              classId={props.classId}
              weekLabel={weekLabel}
            />
          ) : (
            <AttendanceStickyTable ariaLabel="Weekly attendance grid" minWidth="40rem">
              <table className="w-full min-w-[40rem] caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className={attendanceStudentHeadClassName()}>
                      Student
                    </TableHead>
                    {props.weekdays.map((day) => (
                      <TableHead
                        key={day}
                        scope="col"
                        className={cn(attendanceStickyHeadClassName(), "text-center text-xs")}
                      >
                        {weekdayShort(day)}
                      </TableHead>
                    ))}
                    <TableHead
                      scope="col"
                      className={attendanceStickyHeadClassName("text-right")}
                    >
                      Weekly %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.weekGrid.map((row) => (
                    <TableRow key={row.studentId} className="group [&>td]:py-3">
                      <TableCell className={attendanceStudentCellClassName()}>
                        {row.displayName}
                      </TableCell>
                      {props.weekdays.map((day) => (
                        <TableCell key={day} className="text-center text-xs">
                          {row.byDay[day] ?? "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums text-sm">
                        {row.weeklyPct != null ? `${row.weeklyPct}%` : "—"}
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
