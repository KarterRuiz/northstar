import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import type { ClassRecordsView } from "@/features/teacher/class-workspace/class-records";

import type {
  ClassDataCenterRecordsData,
  ClassDataCenterRecordsStudentRow,
} from "./load-class-data-center-records";
import { loadClassDataCenterRecords } from "./load-class-data-center-records";

export async function ClassDataCenterRecordsTab({
  classId,
  view,
}: {
  classId: string;
  view: ClassRecordsView | null;
}) {
  const data = await loadClassDataCenterRecords(classId);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load class records.</span> {data.message}
      </div>
    );
  }

  if (view === "report-cards") return <ReportCardsDetail data={data} />;
  if (view === "transition-notes") return <TransitionNotesDetail data={data} />;
  return <RecordsIndex data={data} />;
}

function RecordsIndex({ data }: { data: Extract<ClassDataCenterRecordsData, { ok: true }> }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <WorkspaceSectionHeader
          title="Records"
          description="Report cards and transition notes for this class."
        />
        <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
          <Link href={data.academicReviewHref}>Open in Academic Review</Link>
        </Button>
      </div>

      <div
        className={
          data.transition.relevant
            ? "grid gap-2.5 sm:grid-cols-2"
            : "grid max-w-xl gap-2.5"
        }
      >
        <RecordsLaunchCard
          title="Report Cards"
          primary={data.reportCards.primary}
          secondary={data.reportCards.secondary}
          href={data.reportCardsDetailHref}
        />
        {data.transition.relevant ? (
          <RecordsLaunchCard
            title="Transition Notes"
            primary={data.transition.primary}
            secondary={null}
            href={data.transitionDetailHref}
          />
        ) : null}
      </div>
    </div>
  );
}

function RecordsLaunchCard({
  title,
  primary,
  secondary,
  href,
}: {
  title: string;
  primary: string;
  secondary: string | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card
        variant="interactive"
        className="h-full min-h-[5.25rem] p-3.5 transition-colors duration-150 ease-out group-hover:border-heading group-hover:bg-heading group-hover:text-primary-foreground sm:p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-heading text-sm font-semibold tracking-tight transition-colors group-hover:text-primary-foreground">
              {title}
            </p>
            <p className="ns-meta transition-colors group-hover:text-primary-foreground/75">
              {primary}
            </p>
            {secondary ? (
              <p className="ns-meta transition-colors group-hover:text-primary-foreground/75">
                {secondary}
              </p>
            ) : null}
          </div>
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0 transition-colors group-hover:text-primary-foreground/80"
            aria-hidden
          />
        </div>
      </Card>
    </Link>
  );
}

function ReportCardsDetail({
  data,
}: {
  data: Extract<ClassDataCenterRecordsData, { ok: true }>;
}) {
  return (
    <div className="space-y-4">
      <RecordsDetailHeader
        title="Report Cards"
        summary={[data.reportCards.primary, data.reportCards.secondary]
          .filter(Boolean)
          .join(" · ")}
        backHref={data.recordsIndexHref}
        action={
          <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
            <Link href={data.academicReviewHref}>Open in Academic Review</Link>
          </Button>
        }
      />
      {!data.reportCards.isCurrentYear ? (
        <Card className="p-3.5 sm:p-4">
          <p className="ns-body text-muted-foreground" role="status">
            Report card tracking applies to the current school year. Open a student profile to
            view historical cards when needed.
          </p>
        </Card>
      ) : !data.reportCards.started ? (
        <Card className="p-3.5 sm:p-4">
          <div role="status" className="text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="ns-body">Reporting has not started for this term yet.</p>
              <p className="ns-meta">
                Students are not marked incomplete until reporting is underway.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <RecordsStudentTable
          caption={data.termName ? `Report cards · ${data.termName}` : "Report cards"}
          students={data.reportCardStudents}
        />
      )}
    </div>
  );
}

function TransitionNotesDetail({
  data,
}: {
  data: Extract<ClassDataCenterRecordsData, { ok: true }>;
}) {
  if (!data.transition.relevant) {
    return (
      <div className="space-y-4">
        <RecordsDetailHeader
          title="Transition Notes"
          summary="Not started"
          backHref={data.recordsIndexHref}
        />
        <Card className="p-3.5 sm:p-4">
          <p className="ns-body text-muted-foreground" role="status">
            Transition notes have not started for this class yet.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RecordsDetailHeader
        title="Transition Notes"
        summary={data.transition.primary}
        backHref={data.recordsIndexHref}
        action={
          <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
            <Link href={data.academicReviewHref}>Open in Academic Review</Link>
          </Button>
        }
      />
      <RecordsStudentTable caption="Transition notes" students={data.transitionStudents} />
    </div>
  );
}

function RecordsDetailHeader({
  title,
  summary,
  backHref,
  action,
}: {
  title: string;
  summary: string;
  backHref: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-heading inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none lg:min-h-0"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Records
        </Link>
        <div className="space-y-0.5">
          <h2 className="text-heading text-base font-semibold tracking-tight">{title}</h2>
          <p className="ns-meta">{summary}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function RecordsStudentTable({
  caption,
  students,
}: {
  caption: string;
  students: ClassDataCenterRecordsStudentRow[];
}) {
  if (students.length === 0) {
    return (
      <Card className="p-3.5 sm:p-4">
        <p className="ns-body text-muted-foreground" role="status">
          No students in this class yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
      <div className="overflow-x-auto">
        <Table aria-label={caption}>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((row) => (
              <TableRow key={row.studentId}>
                <TableCell className="font-medium">{row.displayName}</TableCell>
                <TableCell className="text-sm">{row.statusLabel}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
                    <Link href={row.href}>{row.status === "complete" ? "View" : "Open"}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
