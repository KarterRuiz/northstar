"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CommandCenterClassRow,
  CommandCenterCycle,
  CommandCenterOverview,
  CommandCenterStudentRow,
  ReportingWorkspaceView,
} from "@/features/report-cards/load-report-cards-command-center";
import { ReportCardDownloadButton } from "@/features/report-cards/report-card-download-button";
import { ReportCardUploadSheet } from "@/features/report-cards/report-card-upload-sheet";
import {
  classProgressStatusLabel,
  cycleStatusLabel,
  type ClassProgressStatus,
  type ReportingCycleStatus,
  matchesStudentSearch,
  type StudentReportPresence,
} from "@/features/report-cards/reporting-progress";

function cycleKind(status: ReportingCycleStatus): StatusKind {
  if (status === "complete") return "healthy";
  if (status === "in_progress") return "pending";
  return "not_started";
}

function classKind(status: ClassProgressStatus): StatusKind {
  if (status === "complete") return "healthy";
  if (status === "needs_follow_up") return "needs_attention";
  if (status === "in_progress") return "pending";
  return "not_started";
}

function presenceKind(presence: StudentReportPresence): StatusKind {
  if (presence === "final") return "healthy";
  if (presence === "draft") return "pending";
  return "not_started";
}

function presenceLabel(presence: StudentReportPresence): string {
  if (presence === "final") return "Complete";
  if (presence === "draft") return "Draft";
  return "Remaining";
}

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  return day || "—";
}

function metricValue(value: number | null, known: boolean): string {
  if (!known || value == null) return "—";
  return String(value);
}

function matchesStudentQuery(
  row: CommandCenterStudentRow,
  raw: string,
): boolean {
  return matchesStudentSearch(row, raw);
}

const TAB_VALUES: ReportingWorkspaceView[] = [
  "overview",
  "class",
  "student",
  "library",
];

export function ReportCardsWorkspaceShell({
  role,
  cycle,
  overview,
  classes,
  students,
  teachersAvailable,
  yearOptions,
  initialView,
  initialClassId,
  canUpload,
  library,
}: {
  role: Role;
  cycle: CommandCenterCycle;
  overview: CommandCenterOverview;
  classes: CommandCenterClassRow[];
  students: CommandCenterStudentRow[];
  teachersAvailable: boolean;
  yearOptions: string[];
  initialView: ReportingWorkspaceView;
  initialClassId: string | null;
  canUpload: boolean;
  library: ReactNode;
}) {
  const [view, setView] = useState<ReportingWorkspaceView>(
    TAB_VALUES.includes(initialView) ? initialView : "overview",
  );
  const [classFilter, setClassFilter] = useState(initialClassId ?? "");
  const [studentQuery, setStudentQuery] = useState("");

  const filteredStudents = useMemo(() => {
    return students.filter((row) => {
      if (classFilter && row.classId !== classFilter) return false;
      return matchesStudentQuery(row, studentQuery);
    });
  }, [students, classFilter, studentQuery]);

  const followUp = classes
    .filter((row) => row.status === "needs_follow_up" || row.status === "not_started")
    .slice(0, 5);

  const hrefFor = (next: ReportingWorkspaceView, classId?: string) => {
    const params = new URLSearchParams();
    params.set("view", next);
    const cid = classId ?? classFilter;
    if (cid) params.set("classId", cid);
    return `/dashboard/${role}/report-cards?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader density="compact" className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="ns-meta">Current reporting cycle</p>
            <CardTitle className="text-lg sm:text-xl">
              {cycle.schoolYearLabel ?? "No current school year"}
              {cycle.termName ? ` · ${cycle.termName}` : ""}
            </CardTitle>
            {!cycle.termsConfigured ? (
              <p className="ns-muted">
                Reporting cycle not started.
                {cycle.setupHref ? (
                  <>
                    {" "}
                    <Link
                      href={cycle.setupHref}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Set up terms
                    </Link>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="ns-muted">
                {cycle.status === "not_started"
                  ? "The current term has not started yet."
                  : cycle.status === "complete"
                    ? "All configured terms have ended."
                    : "This term is underway."}
              </p>
            )}
          </div>
          <StatusBadge
            status={cycleKind(cycle.status)}
            label={cycleStatusLabel[cycle.status]}
          />
        </CardHeader>
      </Card>

      <section aria-labelledby="report-cards-overview-heading" className="space-y-3">
        <h2 id="report-cards-overview-heading" className="sr-only">
          Completion progress
        </h2>
        {!overview.coverageKnown ? (
          <p className="ns-muted" role="status">
            Completion cannot be calculated right now.
          </p>
        ) : !overview.reportingStarted ? (
          <p className="ns-muted" role="status">
            Completion will appear once a reporting term is underway.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Students"
            value={metricValue(overview.studentCount, true)}
          />
          <MetricCard
            label="Complete"
            value={metricValue(
              overview.completeCount,
              overview.coverageKnown && overview.reportingStarted,
            )}
          />
          <MetricCard
            label="Remaining"
            value={metricValue(
              overview.remainingCount,
              overview.coverageKnown && overview.reportingStarted,
            )}
          />
          <MetricCard
            label="Classes reporting"
            value={
              overview.coverageKnown && overview.reportingStarted
                ? `${overview.classesReportingCount ?? 0}${
                    overview.classCount != null ? ` of ${overview.classCount}` : ""
                  }`
                : "—"
            }
          />
        </div>
      </section>

      <Tabs
        value={view}
        onValueChange={(next) => {
          if (TAB_VALUES.includes(next as ReportingWorkspaceView)) {
            setView(next as ReportingWorkspaceView);
          }
        }}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="class">By class</TabsTrigger>
          <TabsTrigger value="student">By student</TabsTrigger>
          <TabsTrigger value="library">Report library</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {overview.reportingStarted && followUp.length > 0 ? (
            <Card variant="table">
              <div className="px-3.5 py-3">
                <h3 className="ns-card-title text-base">Needs follow-up</h3>
                <p className="ns-muted mt-0.5">
                  Classes that have not finished this reporting period.
                </p>
              </div>
              <ul className="divide-border divide-y">
                {followUp.map((row) => (
                  <li key={row.classId}>
                    <button
                      type="button"
                      className="hover:bg-row-hover flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors"
                      onClick={() => {
                        setClassFilter(row.classId);
                        setView("class");
                      }}
                    >
                      <span className="min-w-0">
                        <span className="ns-table-primary block truncate">
                          {row.classLabel}
                        </span>
                        {teachersAvailable && row.teacherName ? (
                          <span className="ns-meta">{row.teacherName}</span>
                        ) : null}
                      </span>
                      <StatusBadge
                        status={classKind(row.status)}
                        label={classProgressStatusLabel[row.status]}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <p className="ns-muted">
              {overview.reportingStarted
                ? "No classes need follow-up for this period."
                : "Open By class or By student when the cycle begins."}
            </p>
          )}
        </TabsContent>

        <TabsContent value="class" className="space-y-3">
          <ClassProgressTable
            rows={
              classFilter
                ? classes.filter((row) => row.classId === classFilter)
                : classes
            }
            teachersAvailable={teachersAvailable}
            statusKnown={overview.coverageKnown && overview.reportingStarted}
            onOpenClass={(classId) => {
              setClassFilter(classId);
              setView("student");
            }}
          />
          {classFilter ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setClassFilter("")}
            >
              Show all classes
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="student" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="rc-student-q" className="ns-meta">
                Search students
              </label>
              <Input
                id="rc-student-q"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Name, student number, or class"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rc-student-class" className="ns-meta">
                Class
              </label>
              <select
                id="rc-student-class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring flex h-9 min-w-[12rem] rounded-md border px-3 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.classLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <StudentProgressTable
            role={role}
            rows={filteredStudents}
            canUpload={canUpload}
            yearOptions={yearOptions}
            defaultTerm={cycle.termCode ?? undefined}
          />
        </TabsContent>

        <TabsContent value="library">{library}</TabsContent>
      </Tabs>

      <p className="sr-only">
        Progress reports are not part of this workspace yet. {hrefFor("overview")}
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="metric">
      <CardHeader density="metric">
        <p className="ns-meta">{label}</p>
        <p className="text-heading text-2xl font-semibold tabular-nums">{value}</p>
      </CardHeader>
    </Card>
  );
}

function ClassProgressTable({
  rows,
  teachersAvailable,
  statusKnown,
  onOpenClass,
}: {
  rows: CommandCenterClassRow[];
  teachersAvailable: boolean;
  statusKnown: boolean;
  onOpenClass: (classId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="ns-muted py-6" role="status">
        No active classes for the current school year.
      </p>
    );
  }

  const th =
    "text-muted-foreground whitespace-nowrap text-xs font-semibold uppercase tracking-wide";

  return (
    <div className="border-border overflow-x-auto rounded-xl border shadow-sm">
      <Table aria-label="Reporting progress by class">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={th}>Class</TableHead>
            {teachersAvailable ? (
              <TableHead className={`${th} hidden md:table-cell`}>Teacher</TableHead>
            ) : null}
            <TableHead className={th}>Students</TableHead>
            <TableHead className={th}>Complete</TableHead>
            <TableHead className={th}>Remaining</TableHead>
            <TableHead className={th}>Status</TableHead>
            <TableHead className={`${th} text-right`}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.classId}>
              <TableCell className="ns-table-primary">{row.classLabel}</TableCell>
              {teachersAvailable ? (
                <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                  {row.teacherName ?? "—"}
                </TableCell>
              ) : null}
              <TableCell className="tabular-nums">{row.studentCount}</TableCell>
              <TableCell className="tabular-nums">
                {statusKnown ? row.completeCount : "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {statusKnown ? row.remainingCount : "—"}
              </TableCell>
              <TableCell>
                {statusKnown ? (
                  <StatusBadge
                    status={classKind(row.status)}
                    label={classProgressStatusLabel[row.status]}
                  />
                ) : (
                  <span className="ns-meta">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenClass(row.classId)}
                >
                  View students
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StudentProgressTable({
  role,
  rows,
  canUpload,
  yearOptions,
  defaultTerm,
}: {
  role: Role;
  rows: CommandCenterStudentRow[];
  canUpload: boolean;
  yearOptions: string[];
  defaultTerm?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="ns-muted py-6" role="status">
        No students match these filters.
      </p>
    );
  }

  const th =
    "text-muted-foreground whitespace-nowrap text-xs font-semibold uppercase tracking-wide";

  return (
    <div className="border-border overflow-x-auto rounded-xl border shadow-sm">
      <Table aria-label="Reporting progress by student">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={th}>Student</TableHead>
            <TableHead className={th}>Class</TableHead>
            <TableHead className={`${th} hidden sm:table-cell`}>Term</TableHead>
            <TableHead className={th}>Status</TableHead>
            <TableHead className={`${th} hidden md:table-cell`}>
              Last updated
            </TableHead>
            <TableHead className={`${th} text-right`}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.studentId}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="ns-table-primary">{row.studentName}</span>
                  {row.studentNumber ? (
                    <span className="ns-meta">#{row.studentNumber}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm">{row.classLabel}</TableCell>
              <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                {row.termCode ?? "—"}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={presenceKind(row.presence)}
                  label={presenceLabel(row.presence)}
                />
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                {formatUpdated(row.lastUpdated)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {row.fileId ? (
                    <ReportCardDownloadButton
                      fileId={row.fileId}
                      label="Open report"
                      variant="ghost"
                    />
                  ) : (
                    <span className="ns-meta px-2">No report yet</span>
                  )}
                  {canUpload ? (
                    <ReportCardUploadSheet
                      dashboardRole={role}
                      suggestedSchoolYears={yearOptions}
                      defaultTerm={defaultTerm}
                      studentId={row.studentId}
                      studentLabel={row.studentName}
                      studentMeta={[row.classLabel, row.studentNumber ? `#${row.studentNumber}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                      triggerLabel={row.fileId ? "Replace PDF" : "Upload PDF"}
                      triggerVariant="ghost"
                    />
                  ) : null}
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/${role}/students/${row.studentId}`}>
                      Profile
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
