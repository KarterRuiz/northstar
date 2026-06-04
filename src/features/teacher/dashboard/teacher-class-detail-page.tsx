import Link from "next/link";
import type { ReactNode } from "react";

import { FileText, NotebookPen, PenLine, User } from "lucide-react";

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
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  loadTeacherClassPageData,
  type TeacherRosterStudent,
} from "@/features/teacher/dashboard/load-teacher-workspace-data";

const BASE = "/dashboard/teacher";

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
    <Button asChild variant="link" size="sm" className="h-auto min-h-11 px-2 py-2 touch-manipulation lg:min-h-0 lg:px-1 lg:py-0">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function rosterActions(row: TeacherRosterStudent) {
  const gradesHref = `${BASE}/students/${row.studentId}/grades`;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <QuickLink href={`${BASE}/students/${row.studentId}/overview`}>
        <User className="mr-1 size-3.5 shrink-0" aria-hidden />
        Overview
      </QuickLink>
      <QuickLink href={gradesHref}>
        <PenLine className="mr-1 size-3.5 shrink-0" aria-hidden />
        Grades
      </QuickLink>
      <QuickLink href={`${BASE}/students/${row.studentId}/transition-notes`}>
        <NotebookPen className="mr-1 size-3.5 shrink-0" aria-hidden />
        Transition
      </QuickLink>
      <QuickLink href={`${BASE}/students/${row.studentId}/report-cards`}>
        <FileText className="mr-1 size-3.5 shrink-0" aria-hidden />
        Report card
      </QuickLink>
    </div>
  );
}

export async function TeacherClassDetailPageContent({ classId }: { classId: string }) {
  const data = await loadTeacherClassPageData(classId);

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Class roster"
          description="Scoped to your class teacher assignments."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`${BASE}/classes`}>All my classes</Link>
            </Button>
          }
        />
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <span className="font-medium">Could not load this class.</span> {data.message}
        </div>
      </div>
    );
  }

  const { classSummary, students, currentSchoolYearLabel, warnings } = data;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title={classSummary.name}
        description={
          <>
            {classSummary.gradeName} · {classSummary.schoolYearLabel}
            {classSummary.section ? ` · ${classSummary.section}` : ""}. Report card
            completion uses the latest school year label
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
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`${BASE}/classes/${classId}/students/new`}>Add student</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`${BASE}/classes/${classId}/students/bulk`}>Bulk add</Link>
            </Button>
          </div>
        }
      />

      {warnings.length > 0 ? (
        <div
          className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-foreground font-medium">Partial data</p>
          <ul className="mt-2 list-inside list-disc">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
          <CardDescription>Assignment and enrollment snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-wrap gap-3 text-sm">
          <span>
            <span className="text-foreground font-medium">{students.length}</span> active
            enrollments
          </span>
          <Badge variant="secondary" className="capitalize">
            {classSummary.assignmentRole}
          </Badge>
          {!classSummary.isActive ? (
            <Badge variant="outline">Inactive class</Badge>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
          <CardDescription>
            Active student_enrollments for this class. Quick links reuse the existing
            student profile tabs.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {students.length === 0 ? (
            <div className="space-y-4 p-6">
              <ListEmptyState
                title="No students enrolled"
                description="Add students to this class roster, or wait for registrars to enroll them."
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link href={`${BASE}/classes/${classId}/students/new`}>Add student</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`${BASE}/classes/${classId}/students/bulk`}>Bulk add</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
            <Table className="min-w-[32rem]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Student</TableHead>
                  <TableHead scope="col">Grade</TableHead>
                  <TableHead scope="col">Transition</TableHead>
                  <TableHead scope="col" className="hidden md:table-cell">
                    Report card
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`${BASE}/students/${row.studentId}/overview`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.displayName}
                      </Link>
                      <div className="text-muted-foreground mt-0.5 font-mono text-xs md:hidden">
                        {completionBadge(row.reportCardFileForYear, "Report card")}
                      </div>
                    </TableCell>
                    <TableCell>{row.gradeName}</TableCell>
                    <TableCell>
                      {completionBadge(row.transitionSubmitted, "Transition")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {completionBadge(row.reportCardFileForYear, "Report card")}
                    </TableCell>
                    <TableCell className="text-right">
                      {rosterActions(row)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
