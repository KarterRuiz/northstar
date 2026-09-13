import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Search } from "lucide-react";

import { canManageStudents, isRole, type Role } from "@/config/roles";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DirectoryClickableRow,
  DirectoryRowHitTarget,
} from "@/components/workspace/directory-clickable-row";
import { DirectoryPeopleCell } from "@/components/workspace/directory-people-cell";
import {
  DirectoryToolbar,
  DirectoryToolbarFilters,
  DirectoryToolbarSearch,
} from "@/components/workspace/directory-toolbar";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { assertStudentDirectoryAccess } from "@/features/students/profile/access";
import { formatStudentNumberDisplay } from "@/features/students/student-number";
import { StudentsAddMenu } from "@/features/students/students-add-menu";
import { loadStudentDirectory } from "@/features/students/student-directory-queries";

import StudentsDirectoryLoading from "./loading";

export const metadata: Metadata = {
  title: "Students",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

function formatDirectoryDash(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return "—";
  return trimmed;
}

async function StudentsDirectoryResults({
  role,
  searchQuery,
}: {
  role: Role;
  searchQuery?: string;
}) {
  const result = await loadStudentDirectory(searchQuery);

  return (
    <>
      {result.ok ? null : (
        <div
          className="bg-destructive/10 text-destructive mb-4 rounded-lg border border-destructive/30 px-4 py-3 text-sm"
          role="alert"
        >
          <span className="font-medium">Could not load students.</span>{" "}
          {result.message}
        </div>
      )}

      <Card>
        <CardHeader density="compact" className="space-y-3 pb-3 sm:pb-3">
          <div className="space-y-1">
            <CardTitle>Directory</CardTitle>
            <CardDescription>
              Active enrollments. Open a row to view the student profile.
            </CardDescription>
          </div>
          <form
            action={`/dashboard/${role}/students`}
            method="get"
            role="search"
          >
            <DirectoryToolbar className="border-0 pb-0">
              <DirectoryToolbarSearch>
                <label htmlFor="student-search" className="sr-only">
                  Search students
                </label>
                <Input
                  id="student-search"
                  name="q"
                  type="search"
                  placeholder="Search by name or student number…"
                  defaultValue={searchQuery ?? ""}
                  autoComplete="off"
                />
              </DirectoryToolbarSearch>
              <DirectoryToolbarFilters>
                <Button type="submit" size="sm">
                  Search
                </Button>
                {searchQuery ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/${role}/students`}>Clear</Link>
                  </Button>
                ) : null}
              </DirectoryToolbarFilters>
            </DirectoryToolbar>
          </form>
        </CardHeader>
        <CardContent density="compact" className="space-y-3">
          {result.students.length === 0 && result.ok ? (
            <ListEmptyState
              icon={Search}
              title={
                searchQuery
                  ? "No students match this search"
                  : "Your roster is empty"
              }
              description={
                searchQuery
                  ? "Try a different name or student number, or clear search to see the full active roster."
                  : "Add a single student or import a CSV/Excel roster to populate the directory."
              }
            />
          ) : (
            <Table aria-label="Students directory">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="hidden md:table-cell">Class</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.students.map((student) => {
                  const href = `/dashboard/${role}/students/${student.id}/overview`;
                  const numberLabel = formatStudentNumberDisplay(student.studentNumber);
                  const numberAssigned = numberLabel !== "Not assigned";
                  return (
                    <DirectoryClickableRow key={student.id}>
                      <TableCell>
                        <DirectoryRowHitTarget
                          href={href}
                          label={`Open ${student.fullName}`}
                        />
                        <DirectoryPeopleCell
                          name={student.fullName}
                          meta={
                            numberAssigned ? (
                              <span className="font-mono">{numberLabel}</span>
                            ) : (
                              <span className="text-muted-foreground/80">
                                Not assigned
                              </span>
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="relative z-[2]">
                        {formatDirectoryDash(student.gradeLevel)}
                      </TableCell>
                      <TableCell className="relative z-[2] hidden max-w-[14rem] truncate md:table-cell">
                        {student.homeroomConflict ? (
                          <span className="text-destructive" title="Multiple active homerooms">
                            {formatDirectoryDash(student.classLabel)}
                          </span>
                        ) : (
                          formatDirectoryDash(student.classLabel)
                        )}
                      </TableCell>
                      <TableCell className="relative z-[2]">
                        <Badge variant="success" className="capitalize">
                          {student.status}
                        </Badge>
                      </TableCell>
                    </DirectoryClickableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default async function StudentsDirectoryPage({
  params,
  searchParams,
}: PageProps) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();
  const role = roleParam as Role;
  assertStudentDirectoryAccess(role);

  const sp = await searchParams;
  const rawQ = sp?.q;
  const searchQuery =
    typeof rawQ === "string" ? rawQ : Array.isArray(rawQ) ? rawQ[0] : undefined;

  return (
    <div className="ns-page-shell">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Students"
        description="Search the active roster and open a student profile. Teachers see learners in their assigned classes; leadership and registrar see the full roster."
        actions={canManageStudents(role) ? <StudentsAddMenu role={role} /> : null}
      />

      <Suspense fallback={<StudentsDirectoryLoading />} key={searchQuery ?? ""}>
        <StudentsDirectoryResults role={role} searchQuery={searchQuery} />
      </Suspense>
    </div>
  );
}
