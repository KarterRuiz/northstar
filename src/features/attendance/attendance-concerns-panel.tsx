"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AttendanceConcernsEmpty,
  AttendanceStickyTable,
  attendanceStickyHeadClassName,
  attendanceStudentCellClassName,
  attendanceStudentHeadClassName,
} from "@/features/attendance/attendance-sticky-table";

import { AttendanceRiskBadge } from "./attendance-risk-badge";
import type { AttendanceConcernRow } from "./load-attendance-concerns-data";

type AttendanceConcernsPanelProps = {
  rows: AttendanceConcernRow[];
};

export function AttendanceConcernsPanel({ rows }: AttendanceConcernsPanelProps) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Attendance concerns</CardTitle>
        <CardDescription className="text-sm">
          Students who may benefit from a check-in: 3+ term absences, 5+ tardies, or 2+
          absences in a week. Risk tier guides supportive next steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <AttendanceConcernsEmpty />
        ) : (
          <AttendanceStickyTable ariaLabel="Attendance concerns" minWidth="44rem">
            <table className="w-full min-w-[44rem] caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={attendanceStudentHeadClassName()}>
                    Student
                  </TableHead>
                  <TableHead scope="col" className={attendanceStickyHeadClassName()}>
                    Class
                  </TableHead>
                  <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                    Absences
                  </TableHead>
                  <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                    Tardies
                  </TableHead>
                  <TableHead scope="col" className={attendanceStickyHeadClassName("text-right")}>
                    Week abs.
                  </TableHead>
                  <TableHead scope="col" className={attendanceStickyHeadClassName("min-w-[7rem]")}>
                    Risk tier
                  </TableHead>
                  <TableHead scope="col" className={attendanceStickyHeadClassName("min-w-[10rem]")}>
                    Suggested action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.studentId}:${row.classId}`} className="group [&>td]:py-3">
                    <TableCell className={attendanceStudentCellClassName()}>
                      <Link
                        href={`/dashboard/teacher/students/${row.studentId}/attendance`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.classLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.termAbsences}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.termTardies}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.weekAbsences}</TableCell>
                    <TableCell>
                      <AttendanceRiskBadge tier={row.tier} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.suggestedAction ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </AttendanceStickyTable>
        )}
      </CardContent>
    </Card>
  );
}
