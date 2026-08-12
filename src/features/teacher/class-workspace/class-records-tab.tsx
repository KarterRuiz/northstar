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

import type { ClassRecordsView } from "./class-records";
import type {
  ClassRecordsStudentRow,
  TeacherClassRecordsData,
} from "./load-teacher-class-records";
import { loadTeacherClassRecords } from "./load-teacher-class-records";
import { classWorkspaceRecordsViewHref } from "./constants";

export async function ClassRecordsTab({
  classId,
  view,
}: {
  classId: string;
  view: ClassRecordsView | null;
}) {
  const data = await loadTeacherClassRecords(classId);

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

  if (view === "report-cards") {
    return <ReportCardsDetail data={data} />;
  }
  if (view === "transition-notes") {
    return <TransitionNotesDetail data={data} />;
  }

  return <RecordsIndex data={data} />;
}

function RecordsIndex({ data }: { data: Extract<TeacherClassRecordsData, { ok: true }> }) {
  return (
    <div className="space-y-4">
      <WorkspaceSectionHeader
        title="Records"
        description="Report cards and transition notes for this class."
      />

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
          href={classWorkspaceRecordsViewHref(data.classId, "report-cards")}
        />
        {data.transition.relevant ? (
          <RecordsLaunchCard
            title="Transition Notes"
            primary={data.transition.primary}
            secondary={null}
            href={classWorkspaceRecordsViewHref(data.classId, "transition-notes")}
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
        <span className="sr-only">Open {title}</span>
      </Card>
    </Link>
  );
}

function ReportCardsDetail({
  data,
}: {
  data: Extract<TeacherClassRecordsData, { ok: true }>;
}) {
  const { reportCards, reportCardStudents, termName } = data;

  return (
    <div className="space-y-4">
      <RecordsDetailHeader
        title="Report Cards"
        summary={[reportCards.primary, reportCards.secondary].filter(Boolean).join(" · ")}
        backHref={data.recordsIndexHref}
        action={
          reportCards.isCurrentYear ? (
            <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
              <Link href={data.reportCardsWorkspaceHref}>Open workspace</Link>
            </Button>
          ) : null
        }
      />

      {!reportCards.isCurrentYear ? (
        <Card className="p-3.5 sm:p-4">
          <p className="ns-body text-muted-foreground" role="status">
            Report card tracking applies to the current school year. Open a student
            profile to view archived cards when needed.
          </p>
        </Card>
      ) : !reportCards.started ? (
        <Card className="p-3.5 sm:p-4">
          <div role="status" className="text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-2">
              <p className="ns-body">Reporting has not started for this term yet.</p>
              <p className="ns-meta">
                Students are not marked incomplete until reporting is underway.
              </p>
              <Button asChild variant="outline" size="sm" className="min-h-11 lg:min-h-8">
                <Link href={data.reportCardsWorkspaceHref}>Open workspace</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <RecordsStudentTable
          caption={termName ? `Report cards · ${termName}` : "Report cards"}
          students={reportCardStudents}
          emptyLabel="No students in this class yet."
        />
      )}
    </div>
  );
}

function TransitionNotesDetail({
  data,
}: {
  data: Extract<TeacherClassRecordsData, { ok: true }>;
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
      />
      <RecordsStudentTable
        caption="Transition notes"
        students={data.transitionStudents}
        emptyLabel="No students in this class yet."
      />
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
  emptyLabel,
}: {
  caption: string;
  students: ClassRecordsStudentRow[];
  emptyLabel: string;
}) {
  if (students.length === 0) {
    return (
      <Card className="p-3.5 sm:p-4">
        <p className="ns-body text-muted-foreground" role="status">
          {emptyLabel}
        </p>
      </Card>
    );
  }

  return (
    <div className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
      <div className="overflow-x-auto overscroll-x-contain">
        <Table aria-label={caption} className="min-w-[20rem]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Student</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((row) => (
              <TableRow key={row.studentId}>
                <TableCell className="py-2.5 sm:py-2">
                  <span className="ns-table-primary">{row.displayName}</span>
                </TableCell>
                <TableCell className="py-2.5 sm:py-2">
                  <span
                    className={
                      row.status === "complete"
                        ? "text-muted-foreground text-sm"
                        : "text-heading text-sm"
                    }
                  >
                    {row.statusLabel}
                  </span>
                </TableCell>
                <TableCell className="py-2.5 text-right sm:py-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="min-h-11 lg:min-h-8"
                  >
                    <Link href={row.href}>
                      {row.status === "complete" ? "View" : "Open"}
                    </Link>
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
