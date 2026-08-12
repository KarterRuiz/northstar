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
import {
  canAccessFollowUp,
  canManageParentRecordRequests,
  type Role,
} from "@/config/roles";
import { OpenFollowUpsCard } from "@/features/follow-up/open-follow-ups-card";
import { loadOpenFollowUpsForStudent } from "@/features/follow-up/load-follow-up-workspace";
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

import { loadStudentInterventions } from "@/features/interventions/load-student-interventions";
import { InterventionStatusBadge } from "@/features/interventions/intervention-badges";
import { loadParentRequestsForStudent } from "@/features/parent-requests/load-parent-requests";
import { ParentRequestStatusBadge } from "@/features/parent-requests/parent-request-status-badge";

import { loadStudentIntelligence } from "../load-student-intelligence";
import { ProfileEmptyState } from "../profile-empty-state";
import {
  getReportCardSummaries,
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
  const [
    intel,
    notesLoad,
    attendanceLoad,
    behaviorLoad,
    interventionsLoad,
    reportRows,
    parentReqLoad,
    openFollowUps,
  ] = await Promise.all([
    loadStudentIntelligence(studentId, { viewerRole: role }),
    loadTransitionNotes(studentId),
    loadStudentAttendanceProfile(studentId, role),
    loadStudentBehaviorProfile(studentId, role),
    loadStudentInterventions(studentId),
    getReportCardSummaries(studentId),
    canManageParentRecordRequests(role)
      ? loadParentRequestsForStudent(studentId)
      : Promise.resolve({ ok: true as const, rows: [] }),
    canAccessFollowUp(role)
      ? loadOpenFollowUpsForStudent(role, studentId)
      : Promise.resolve([]),
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

  const attendancePctLabel =
    attendanceLoad.ok && attendanceLoad.termAttendancePct != null
      ? `${Math.round(attendanceLoad.termAttendancePct)}%`
      : "—";
  const activeInterventions =
    interventionsLoad.ok === true
      ? interventionsLoad.interventions.filter((i) =>
          ["active", "monitoring", "escalated"].includes(i.status),
        )
      : [];
  const parentRows = parentReqLoad.ok === true ? parentReqLoad.rows : [];
  const openParentRequests = parentRows.filter((r) =>
    ["received", "approved"].includes(r.status),
  ).length;
  const latestReport = reportRows[0] ?? null;
  const recentConcerns =
    behaviorLoad.ok === true ? behaviorLoad.concerns.slice(0, 4) : [];

  return (
    <div className="space-y-5">
      {canAccessFollowUp(role) ? (
        <OpenFollowUpsCard
          role={role}
          items={openFollowUps}
          prefill={{
            studentId,
            studentLabel: profile.fullName,
            category: "students",
          }}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Attendance (term)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{attendancePctLabel}</p>
            <Link
              href={`${base}/attendance`}
              className="text-primary mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline"
            >
              Recent marks
            </Link>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Class average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {readiness?.overallPercent != null
                ? formatOverallGrade({
                    percent: readiness.overallPercent,
                    letter: readiness.overallLetter,
                    isPartial: readiness.isPartialGrade,
                  })
                : "—"}
            </p>
            <Link
              href={`${base}/academics`}
              className="text-primary mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline"
            >
              Academics tab
            </Link>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Open interventions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{activeInterventions.length}</p>
            <Link
              href={`${base}/interventions`}
              className="text-primary mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline"
            >
              Manage supports
            </Link>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Open parent requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {canManageParentRecordRequests(role) ? openParentRequests : "—"}
            </p>
            {canManageParentRecordRequests(role) ? (
              <Link
                href={`${base}/parent-communication`}
                className="text-primary mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline"
              >
                Communication hub
              </Link>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Visible to registrars &amp; leadership
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
              href={`${base}/academics`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View academics
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
                {attendanceLoad.recent.length > 0 ? (
                  <div className="border-border/60 border-t pt-3">
                    <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                      Recent attendance
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      {attendanceLoad.recent.slice(0, 5).map((rec) => (
                        <li
                          key={rec.id}
                          className="flex justify-between gap-3 tabular-nums"
                        >
                          <span className="text-muted-foreground">{rec.attendanceDate}</span>
                          <span className="font-medium">
                            {attendanceStatusLabels[rec.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
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
              <CardTitle className="text-base">Behavior</CardTitle>
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

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Current interventions</CardTitle>
              <CardDescription>Active, monitoring, or escalated supports.</CardDescription>
            </div>
            <Link
              href={`${base}/interventions`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {interventionsLoad.ok !== true ? (
              <p className="text-muted-foreground text-sm">{interventionsLoad.message}</p>
            ) : activeInterventions.length === 0 ? (
              <ProfileEmptyState
                icon={ClipboardList}
                title="No open interventions"
                description="When a support plan is active for this student, it appears here."
              />
            ) : (
              <ul className="space-y-3">
                {activeInterventions.slice(0, 4).map((row) => (
                  <li key={row.id} className="border-border/60 space-y-1 rounded-lg border px-3 py-2">
                    <p className="text-sm font-medium leading-snug">{row.title}</p>
                    <InterventionStatusBadge status={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Parent requests</CardTitle>
              <CardDescription>Formal record requests for this student.</CardDescription>
            </div>
            {canManageParentRecordRequests(role) ? (
              <Link
                href={`${base}/parent-communication`}
                className="text-primary text-xs font-medium underline-offset-4 hover:underline"
              >
                Hub
              </Link>
            ) : null}
          </CardHeader>
          <CardContent>
            {!canManageParentRecordRequests(role) ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Parent record requests are listed for registrars and school leadership in the
                Parent communication tab.
              </p>
            ) : parentReqLoad.ok !== true ? (
              <p className="text-destructive text-sm" role="alert">
                {parentReqLoad.message}
              </p>
            ) : parentRows.length === 0 ? (
              <ProfileEmptyState
                icon={ClipboardList}
                title="No requests on file"
                description="Create a parent record request when a family asks for official documents."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                      Opened
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parentRows.slice(0, 4).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm tabular-nums">
                        {row.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <ParentRequestStatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Latest report card</CardTitle>
              <CardDescription>Most recently issued PDF on file.</CardDescription>
            </div>
            <Link
              href={`${base}/report-cards`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              All PDFs
            </Link>
          </CardHeader>
          <CardContent>
            {latestReport ? (
              <div className="space-y-2">
                <p className="text-sm font-medium leading-snug">{latestReport.headline}</p>
                <p className="text-muted-foreground text-xs">
                  {latestReport.academicYear} · {latestReport.termLabel} · Issued{" "}
                  {latestReport.issuedOn}
                </p>
                <Badge variant="secondary" className="capitalize">
                  {latestReport.status}
                </Badge>
              </div>
            ) : (
              <ProfileEmptyState
                icon={ClipboardList}
                title="No report cards yet"
                description="When a PDF is uploaded for this student, its status appears here."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {recentConcerns.length > 0 ? (
        <Card className={CARD_CHROME}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Recent behavior incidents</CardTitle>
              <CardDescription>Support concerns (medium or higher) from the class log.</CardDescription>
            </div>
            <Link
              href={`${base}/behavior`}
              className="text-primary text-xs font-medium underline-offset-4 hover:underline"
            >
              View timeline
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentConcerns.map((row) => (
                <li
                  key={row.id}
                  className="border-border/60 flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium leading-snug">
                      {row.generatedSummary?.trim() || row.title}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">{row.behaviorDate}</p>
                  </div>
                  <Badge variant="outline" className="w-fit shrink-0 text-[10px] capitalize">
                    {row.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
