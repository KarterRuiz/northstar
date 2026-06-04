import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Heart,
  Tags,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import type { Role } from "@/config/roles";
import {
  reportReadinessStatusLabel,
  type ReportReadinessStatus,
} from "@/features/teacher/gradebook/report-readiness";
import { formatOverallGrade } from "@/features/teacher/gradebook/calculations";

import {
  attendanceStatusLabels,
  loadStudentAttendanceProfile,
} from "@/features/attendance-behavior/load-student-attendance-profile";
import { AttendanceRiskBadge } from "@/features/attendance/attendance-risk-badge";
import { loadStudentBehaviorProfile } from "@/features/attendance-behavior/load-student-behavior-profile";

import { loadStudentIntelligence } from "../load-student-intelligence";
import { ProfileEmptyState } from "../profile-empty-state";
import {
  loadStudentProfileResult,
  loadTransitionNotes,
} from "../supabase-profile-data";

const CARD_CHROME = "border-border/70 shadow-sm";

type OverviewTabProps = {
  studentId: string;
  role: Role;
};

function readinessVariant(
  status: ReportReadinessStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ready") return "default";
  if (status === "needs_grades") return "destructive";
  if (status === "missing_transition_note") return "secondary";
  return "outline";
}

export async function OverviewTab({ studentId, role }: OverviewTabProps) {
  const result = await loadStudentProfileResult(studentId);
  const [intel, notesLoad, attendanceLoad, behaviorLoad] = await Promise.all([
    loadStudentIntelligence(studentId, { viewerRole: role }),
    loadTransitionNotes(studentId),
    loadStudentAttendanceProfile(studentId, role),
    loadStudentBehaviorProfile(studentId, role),
  ]);
  const base = `/dashboard/${role}/students/${studentId}`;

  if (result.kind === "not_found") {
    notFound();
  }

  if (result.kind === "error") {
    return (
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Overview</CardTitle>
          <CardDescription>Student information could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm" role="alert">
            {result.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const profile = result.profile;
  const readiness = intel.kind === "ok" ? intel.data.readiness : null;
  const latestNote =
    notesLoad.kind === "ok" && notesLoad.notes.length > 0
      ? notesLoad.notes[0]
      : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className={`${CARD_CHROME} lg:col-span-2`}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">At a glance</CardTitle>
            <CardDescription>
              Key academic signals for {profile.fullName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Running grade
                </dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {readiness?.overallPercent != null
                    ? formatOverallGrade({
                        percent: readiness.overallPercent,
                        letter: readiness.overallLetter,
                        isPartial: readiness.isPartialGrade,
                      })
                    : "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Missing assignments
                </dt>
                <dd
                  className={`text-lg font-semibold tabular-nums ${
                    readiness && readiness.missingAssignmentCount > 0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {readiness ? readiness.missingAssignmentCount : "—"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Report readiness
                </dt>
                <dd>
                  {readiness ? (
                    <Badge variant={readinessVariant(readiness.status)}>
                      {reportReadinessStatusLabel[readiness.status]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  Enrollment
                </dt>
                <dd>
                  <Badge variant="secondary" className="capitalize">
                    {profile.status}
                  </Badge>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {profile.gradeLevel} · {profile.homeroom}
                  </span>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className={CARD_CHROME}>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base">Teacher notes</CardTitle>
            <CardDescription>Latest transition or handoff note.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestNote ? (
              <>
                <p className="text-sm leading-relaxed">{latestNote.summary}</p>
                <p className="text-muted-foreground text-xs">
                  {latestNote.authorName} · Updated{" "}
                  {latestNote.updatedAt.slice(0, 10)}
                </p>
                <Link
                  href={`${base}/transition-notes`}
                  className="text-primary text-xs font-medium underline-offset-4 hover:underline"
                >
                  View all transition notes
                </Link>
              </>
            ) : (
              <ProfileEmptyState
                icon={ClipboardList}
                title="No notes yet"
                description="Transition notes and handoff narratives appear here when recorded."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {intel.kind === "ok" && intel.data.recentAssignments.length > 0 ? (
        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Recent assignments</CardTitle>
              <CardDescription>From the class gradebook.</CardDescription>
            </div>
            <Link
              href={`${base}/grades`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View grades
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                    Assignment
                  </TableHead>
                  <TableHead className="text-muted-foreground hidden text-xs font-semibold uppercase sm:table-cell">
                    Due
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                    Score
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intel.data.recentAssignments.slice(0, 5).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {row.dueDate?.slice(0, 10) ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{row.scoreLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Attendance</CardTitle>
              <CardDescription>Current term absences and tardies.</CardDescription>
            </div>
            <Link
              href={`${base}/attendance`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {attendanceLoad.ok ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Absences</dt>
                  <dd className="font-semibold tabular-nums">{attendanceLoad.termAbsences}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tardies</dt>
                  <dd className="font-semibold tabular-nums">{attendanceLoad.termTardies}</dd>
                </div>
                {attendanceLoad.recent[0] ? (
                  <div className="border-border/60 border-t pt-3">
                    <p className="text-muted-foreground text-xs">Most recent</p>
                    <p className="mt-1 font-medium">
                      {attendanceStatusLabels[attendanceLoad.recent[0].status]} ·{" "}
                      {attendanceLoad.recent[0].attendanceDate}
                    </p>
                  </div>
                ) : null}
                <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3">
                  <AttendanceRiskBadge tier={attendanceLoad.riskTier} />
                  {attendanceLoad.suggestedAction ? (
                    <span className="text-muted-foreground text-xs">
                      {attendanceLoad.suggestedAction}
                    </span>
                  ) : null}
                </div>
              </dl>
            ) : (
              <ProfileEmptyState
                icon={CalendarDays}
                title="No attendance data"
                description={attendanceLoad.message}
              />
            )}
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Student support</CardTitle>
              <CardDescription>Recognitions and documented support moments.</CardDescription>
            </div>
            <Link
              href={`${base}/behavior`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {behaviorLoad.ok ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Positive notes</dt>
                  <dd className="font-semibold tabular-nums">{behaviorLoad.positiveCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Support concerns (med/high)</dt>
                  <dd className="font-semibold tabular-nums">{behaviorLoad.concernCount}</dd>
                </div>
                {behaviorLoad.positives[0] ? (
                  <div className="border-border/60 border-t pt-3">
                    <p className="text-muted-foreground text-xs">Latest recognition</p>
                    <p className="mt-1 font-medium">
                      {behaviorLoad.positives[0].generatedSummary?.trim()
                        || behaviorLoad.positives[0].title}
                    </p>
                  </div>
                ) : null}
              </dl>
            ) : (
              <ProfileEmptyState
                icon={Heart}
                title="No support notes yet"
                description={behaviorLoad.message}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-base">Tags</CardTitle>
          <CardDescription>Programs and supports on file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.tags.length === 0 ? (
            <ProfileEmptyState
              icon={Tags}
              title="No tags on file"
              description="Program or support labels show here when assigned."
            />
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Student tags">
              {profile.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="outline">{tag}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Separator className="bg-border/60" />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Directory details: student number {profile.studentNumber}, DOB{" "}
            {profile.dateOfBirth}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
