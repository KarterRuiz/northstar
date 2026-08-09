import Link from "next/link";
import { FileText, LineChart } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STAFF_PROGRESS_REPORTS_ARCHITECTURE } from "@/features/staff-profile/architecture-notes";
import type {
  StaffClassAcademicRow,
  StaffReportCardCompletion,
  StaffTransitionNoteRow,
} from "@/features/staff-profile/load-staff-leadership-metrics";
import { ProfileEmptyState } from "@/features/students/profile/profile-empty-state";

type StaffStudentRecordsTabProps = {
  viewerRole: string;
  hasLinkedProfile: boolean;
  transitionNotes: StaffTransitionNoteRow[];
  transitionCompleted: number;
  transitionPendingReview: number;
  reportCards: StaffReportCardCompletion;
  classAcademics: StaffClassAcademicRow[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function noteStatusKind(status: string): StatusKind {
  switch (status) {
    case "reviewed":
      return "healthy";
    case "submitted":
      return "needs_attention";
    case "archived":
      return "inactive";
    case "reopened":
      return "pending";
    default:
      return "pending";
  }
}

function noteStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "reviewed":
      return "Reviewed";
    case "archived":
      return "Archived";
    case "reopened":
      return "Reopened";
    default:
      return status;
  }
}

export function StaffStudentRecordsTab({
  viewerRole,
  hasLinkedProfile,
  transitionNotes,
  transitionCompleted,
  transitionPendingReview,
  reportCards,
  classAcademics,
}: StaffStudentRecordsTabProps) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="ns-section-title">Transition notes</h2>
          <p className="ns-muted">
            Student transition notes authored by this teacher. Links open the student
            record — notes are not duplicated here.
          </p>
        </div>

        {!hasLinkedProfile ? (
          <ProfileEmptyState
            icon={FileText}
            title="Account not linked yet"
            description="Transition notes appear once this staff member has an activated account and authors notes."
          />
        ) : transitionNotes.length === 0 ? (
          <ProfileEmptyState
            icon={FileText}
            title="No transition notes yet"
            description="When this teacher authors transition notes, they will list here with status and links."
          />
        ) : (
          <>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                {transitionNotes.length} note
                {transitionNotes.length === 1 ? "" : "s"}
              </span>
              {transitionCompleted > 0 ? (
                <span>{transitionCompleted} reviewed</span>
              ) : null}
              {transitionPendingReview > 0 ? (
                <span>{transitionPendingReview} awaiting review</span>
              ) : null}
            </div>
            <Card variant="table">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead>Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transitionNotes.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="ns-table-primary">
                          {note.studentName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {note.classLabel ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={noteStatusKind(note.status)}
                            label={noteStatusLabel(note.status)}
                          />
                        </TableCell>
                        <TableCell>{formatDate(note.createdAt)}</TableCell>
                        <TableCell>{formatDate(note.reviewedAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <Link
                              href={note.noteHref}
                              className="text-primary font-medium hover:underline"
                            >
                              Note
                            </Link>
                            <Link
                              href={`/dashboard/${viewerRole}/students/${note.studentId}/overview`}
                              className="text-primary font-medium hover:underline"
                            >
                              Student
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <div className="border-border/70 border-t" />

      <section className="space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="ns-section-title">Report cards</h2>
          <p className="ns-muted">
            Completion for students enrolled in this teacher&apos;s classes, using
            existing report-card files — not a second copy of records.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card variant="metric">
            <CardHeader className="pb-2">
              <CardDescription>
                {reportCards.schoolYearLabel
                  ? `Coverage · ${reportCards.schoolYearLabel}`
                  : "Coverage"}
              </CardDescription>
              <CardTitle className="text-xl">
                {!reportCards.available || !reportCards.coverageKnown
                  ? "Not available"
                  : !reportCards.reportingStarted
                    ? "Cycle not started"
                    : reportCards.totalStudents === 0
                      ? "No students"
                      : reportCards.remainingCount === 0
                        ? `${reportCards.completeCount} / ${reportCards.completeCount} complete`
                        : `${reportCards.completeCount} complete · ${reportCards.remainingCount} remaining`}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {reportCards.reportingStarted && reportCards.completedTermCodes.length > 0
                ? `Completed terms: ${reportCards.completedTermCodes.join(", ")}`
                : "Shown only after term end dates have passed."}
              {reportCards.commentsComplete != null ? (
                <span className="mt-1 block">
                  Narrative comments by this teacher: {reportCards.commentsComplete}{" "}
                  complete
                  {reportCards.commentsDraft
                    ? ` · ${reportCards.commentsDraft} draft`
                    : ""}
                </span>
              ) : null}
            </CardContent>
          </Card>

          <Card variant="muted">
            <CardHeader>
              <CardTitle className="ns-card-title">By class</CardTitle>
              <CardDescription>
                Open the report-card registry filtered to each class.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classAcademics.length === 0 ? (
                <p className="ns-muted">No assigned classes.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {classAcademics.map((c) => (
                    <li
                      key={c.classId}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-foreground font-medium">
                        {c.className}
                        {c.section ? ` · ${c.section}` : ""}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {c.studentCount} students
                        </span>
                      </span>
                      <Link
                        href={c.reportCardsHref}
                        className="text-primary font-medium hover:underline"
                      >
                        Open registry
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <Link
                  href={`/dashboard/${viewerRole}/report-cards`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  All report cards
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="border-border/70 border-t" />

      <section className="space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="ns-section-title">Progress reports</h2>
          <p className="ns-muted">
            Slot reserved for a future progress-report product. No records are invented.
          </p>
        </div>
        <ProfileEmptyState
          icon={LineChart}
          title="Progress reports will appear here once enabled."
          description={STAFF_PROGRESS_REPORTS_ARCHITECTURE}
        />
      </section>
    </div>
  );
}
