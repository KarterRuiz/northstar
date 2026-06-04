import Link from "next/link";
import { CalendarDays } from "lucide-react";

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
import type { Role } from "@/config/roles";
import {
  attendanceStatusLabels,
  loadStudentAttendanceProfile,
} from "@/features/attendance-behavior/load-student-attendance-profile";
import { AttendanceRiskBadge } from "@/features/attendance/attendance-risk-badge";
import { AttendanceTrendBadge } from "@/features/attendance/attendance-trend-badge";

import { AttendanceInterventionAction } from "../attendance-intervention-action";
import { ProfileEmptyState } from "../profile-empty-state";

const CARD_CHROME = "border-border/70 shadow-sm";

type AttendanceTabProps = {
  studentId: string;
  role: Role;
};

export async function AttendanceTab({ studentId, role }: AttendanceTabProps) {
  const data = await loadStudentAttendanceProfile(studentId, role);
  const base = `/dashboard/${role}/students/${studentId}`;

  if (!data.ok) {
    return (
      <Card className={CARD_CHROME}>
        <CardContent className="pt-6">
          <ProfileEmptyState
            icon={CalendarDays}
            title="Attendance unavailable"
            description={data.message}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {role === "teacher" ? (
          <Link
            href="/dashboard/teacher/attendance"
            className="text-primary text-xs font-medium underline-offset-4 hover:underline"
          >
            Open attendance workspace
          </Link>
        ) : null}
        <AttendanceInterventionAction
          studentId={studentId}
          classId={data.classId}
          studentName={data.studentDisplayName}
          termAbsences={data.termAbsences}
          termTardies={data.termTardies}
          riskTier={data.riskTier}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Attendance % (term)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.termAttendancePct != null ? `${data.termAttendancePct}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Absences (term)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.termAbsences}</p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tardies (term)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.termTardies}</p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Excused (term)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.termExcused}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={CARD_CHROME}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Attendance support</CardTitle>
          {data.suggestedAction ? (
            <CardDescription className="text-xs">
              Suggested next step: {data.suggestedAction}
            </CardDescription>
          ) : (
            <CardDescription className="text-xs">
              Patterns look steady this term — keep encouraging consistent arrival.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <AttendanceRiskBadge tier={data.riskTier} />
        </CardContent>
      </Card>

      <Card className={CARD_CHROME}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly summary ({data.monthlySummary.monthLabel})
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">vs prior month:</span>
            <AttendanceTrendBadge trend={data.monthlySummary.trend} />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          <p>
            <span className="text-muted-foreground">Days marked:</span>{" "}
            {data.monthlySummary.daysMarked}
          </p>
          <p>
            <span className="text-muted-foreground">Absences:</span>{" "}
            {data.monthlySummary.absences}
          </p>
          <p>
            <span className="text-muted-foreground">Tardies:</span>{" "}
            {data.monthlySummary.tardies}
          </p>
          <p>
            <span className="text-muted-foreground">Attendance %:</span>{" "}
            {data.monthlySummary.attendancePct != null
              ? `${data.monthlySummary.attendancePct}%`
              : "—"}
          </p>
        </CardContent>
      </Card>

      <Card className={CARD_CHROME}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">This week</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">vs prior week:</span>
            <AttendanceTrendBadge trend={data.weeklyTrend} />
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={CARD_CHROME}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Recent attendance</CardTitle>
            <CardDescription>Latest marks from class attendance.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {data.recent.length === 0 ? (
            <div className="p-6">
              <ProfileEmptyState
                icon={CalendarDays}
                title="No attendance yet"
                description="Daily attendance will appear here once recorded for this class."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.attendanceDate}</TableCell>
                    <TableCell>{attendanceStatusLabels[row.status]}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.notes?.trim() || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        <Link href={`${base}/overview`} className="text-primary underline-offset-4 hover:underline">
          Back to overview
        </Link>
      </p>
    </div>
  );
}
