import type { ReactNode } from "react";
import Link from "next/link";

import { FileText, HeartHandshake, NotebookPen, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { siteConfig } from "@/config/site";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import {
  WorkspacePageHeader,
  WorkspaceSectionHeader,
} from "@/components/workspace/workspace-headers";

import {
  loadTeacherWorkspaceData,
  type TeacherRosterStudent,
} from "./load-teacher-workspace-data";
import { TeacherSupportWidgets } from "./teacher-support-widgets";

const ROLE = "teacher" as const;
const BASE = `/dashboard/${ROLE}`;

function completionBadge(done: boolean, label: string) {
  return (
    <Badge variant={done ? "secondary" : "outline"} className="whitespace-nowrap">
      {done ? `${label} · Done` : `${label} · Needed`}
    </Badge>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      variant="link"
      size="sm"
      className="h-auto min-h-11 px-2 py-2 touch-manipulation lg:min-h-0 lg:px-1 lg:py-0"
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function rosterActions(row: TeacherRosterStudent) {
  const overview = `${BASE}/students/${row.studentId}/overview`;
  const transition = `${BASE}/students/${row.studentId}/transition-notes`;
  const report = `${BASE}/students/${row.studentId}/report-cards`;
  const interventions = `${BASE}/students/${row.studentId}/interventions`;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <QuickLink href={overview}>
        <User className="mr-1 size-3.5 shrink-0" aria-hidden />
        Overview
      </QuickLink>
      <QuickLink href={interventions}>
        <HeartHandshake className="mr-1 size-3.5 shrink-0" aria-hidden />
        Interventions
      </QuickLink>
      <QuickLink href={transition}>
        <NotebookPen className="mr-1 size-3.5 shrink-0" aria-hidden />
        Transition
      </QuickLink>
      <QuickLink href={report}>
        <FileText className="mr-1 size-3.5 shrink-0" aria-hidden />
        Report card
      </QuickLink>
    </div>
  );
}

export async function TeacherDashboardView() {
  const data = await loadTeacherWorkspaceData();

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Teacher overview"
          description="Your assigned classes and learners from Supabase."
        />
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">Could not load your workspace</p>
          <p className="mt-1 opacity-90">{data.message}</p>
        </div>
      </div>
    );
  }

  const { classes, roster, currentSchoolYearLabel, warnings } = data;

  const pendingTransition = roster.filter((r) => !r.transitionSubmitted);
  const missingReport = roster.filter((r) => !r.reportCardFileForYear);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Teacher overview"
        description={
          <>
            Classes and students come from your{" "}
            <span className="text-foreground font-medium">class teacher</span>{" "}
            assignments and active enrollments only. Report card completion uses
            the latest school year label
            {currentSchoolYearLabel ? (
              <>
                :{" "}
                <span className="text-foreground font-medium">
                  {currentSchoolYearLabel}
                </span>
              </>
            ) : (
              " (none configured yet)"
            )}
            .
          </>
        }
      />

      {warnings.length > 0 ? (
        <div
          className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-foreground font-medium">Some data may be incomplete.</p>
          <ul className="mt-2 list-inside list-disc space-y-0.5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section aria-labelledby="assigned-classes-heading" className="space-y-3">
        <WorkspaceSectionHeader
          id="assigned-classes-heading"
          eyebrow="Classes"
          title="Assigned classes"
          description="Homeroom and co-teaching assignments from class_teachers."
        />
        {classes.length === 0 ? (
          <ListEmptyState
            title="No classes assigned yet"
            description="When leadership links your profile to classes in class management, they will appear here with live enrollment counts."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <li key={cls.id}>
                <Card className="h-full">
                  <CardHeader className="space-y-1 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        <Link
                          href={`${BASE}/classes/${cls.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {cls.name}
                        </Link>
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {cls.assignmentRole}
                      </Badge>
                    </div>
                    <CardDescription>
                      {cls.gradeName} · {cls.schoolYearLabel}
                      {cls.section ? ` · ${cls.section}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p>
                      <span className="text-foreground font-medium">
                        {cls.studentCount}
                      </span>{" "}
                      students
                    </p>
                    {!cls.isActive ? (
                      <Badge variant="outline" className="text-xs">
                        Inactive class
                      </Badge>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="students-heading" className="space-y-3">
        <WorkspaceSectionHeader
          id="students-heading"
          eyebrow="Roster"
          title="Students in your classes"
          description="One row per active enrollment. Completion reflects a submitted transition note and at least one report card file for the current school year label."
        />
        <Card>
          <CardContent className="p-0 sm:p-0">
            {roster.length === 0 ? (
              <div className="p-6">
                <ListEmptyState
                  title="No active enrollments"
                  description="Students enrolled in your assigned classes will appear here with quick links into their profiles."
                />
              </div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
              <Table className="min-w-[36rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Student</TableHead>
                    <TableHead scope="col" className="hidden sm:table-cell">
                      Class
                    </TableHead>
                    <TableHead scope="col">Grade</TableHead>
                    <TableHead scope="col">Transition</TableHead>
                    <TableHead scope="col" className="hidden lg:table-cell">
                      Report card
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((row) => (
                    <TableRow key={`${row.classId}-${row.studentId}`}>
                      <TableCell className="font-medium">
                        <Link
                          href={`${BASE}/students/${row.studentId}/overview`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.displayName}
                        </Link>
                        <div className="text-muted-foreground mt-0.5 font-mono text-xs lg:hidden">
                          {completionBadge(
                            row.reportCardFileForYear,
                            "Report card",
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden max-w-[14rem] truncate sm:table-cell">
                        {row.classLabel}
                      </TableCell>
                      <TableCell>{row.gradeName}</TableCell>
                      <TableCell>
                        {completionBadge(row.transitionSubmitted, "Transition")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {completionBadge(row.reportCardFileForYear, "Report card")}
                      </TableCell>
                      <TableCell className="text-right">{rosterActions(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <TeacherSupportWidgets />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="transition-queue-heading" className="space-y-3">
          <WorkspaceSectionHeader
            id="transition-queue-heading"
            eyebrow="Follow-up"
            title="Students without a submitted transition note"
            description="Submit from the student profile transition tab or start a structured note."
          />
          <Card>
            <CardContent className="p-0 sm:p-0">
              {pendingTransition.length === 0 ? (
                <div className="p-6">
                  <ListEmptyState
                    title="All caught up"
                    description="Every enrolled student in your assigned classes has at least one submitted transition note."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto overscroll-x-contain">
                <Table className="min-w-[20rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Student</TableHead>
                      <TableHead scope="col" className="hidden sm:table-cell">
                        Class
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Open
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTransition.slice(0, 25).map((row) => (
                      <TableRow key={`tn-${row.classId}-${row.studentId}`}>
                        <TableCell className="font-medium">{row.displayName}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {row.classLabel}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="secondary" size="sm">
                            <Link
                              href={`${BASE}/students/${row.studentId}/transition-notes`}
                            >
                              Transition
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
              {pendingTransition.length > 25 ? (
                <p className="text-muted-foreground border-t px-3 py-2 text-xs sm:px-4">
                  Showing 25 of {pendingTransition.length}. Use the roster table for the
                  full list.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="report-queue-heading" className="space-y-3">
          <WorkspaceSectionHeader
            id="report-queue-heading"
            eyebrow="Follow-up"
            title={
              currentSchoolYearLabel
                ? `Missing report card file (${currentSchoolYearLabel})`
                : "Missing report card file"
            }
            description="Compared to report_card_files for the latest school year label."
          />
          <Card>
            <CardContent className="p-0 sm:p-0">
              {missingReport.length === 0 ? (
                <div className="p-6">
                  <ListEmptyState
                    title="No gaps for this year label"
                    description="Each student has at least one report card PDF on file for the current school year, or no year is configured yet."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto overscroll-x-contain">
                <Table className="min-w-[20rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Student</TableHead>
                      <TableHead scope="col" className="hidden sm:table-cell">
                        Class
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        Open
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingReport.slice(0, 25).map((row) => (
                      <TableRow key={`rc-${row.classId}-${row.studentId}`}>
                        <TableCell className="font-medium">{row.displayName}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {row.classLabel}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`${BASE}/students/${row.studentId}/report-cards`}>
                              Report cards
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
              {missingReport.length > 25 ? (
                <p className="text-muted-foreground border-t px-3 py-2 text-xs sm:px-4">
                  Showing 25 of {missingReport.length}. Use the roster table for the full
                  list.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

    </div>
  );
}
