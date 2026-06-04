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
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { assertStudentDirectoryAccess } from "@/features/students/profile/access";
import { loadStudentDirectory } from "@/features/students/student-directory-queries";

import StudentsDirectoryLoading from "./loading";

export const metadata: Metadata = {
  title: "Students",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

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
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            Active enrollments only. Links open the student profile for this
            workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            action={`/dashboard/${role}/students`}
            method="get"
            role="search"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="student-search" className="text-sm font-medium">
                Search
              </label>
              <Input
                id="student-search"
                name="q"
                type="search"
                placeholder="Name or external ID…"
                defaultValue={searchQuery ?? ""}
                autoComplete="off"
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="submit">Search</Button>
              {searchQuery ? (
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/${role}/students`}>Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>

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
                  ? "Try a different name or external ID, or clear the filter to see the full active roster."
                  : "Seed enrollments or add rows in Supabase to see learners appear in this directory."
              }
            />
          ) : (
            <Table aria-label="Students directory">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Student #</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="hidden md:table-cell">Class</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/${role}/students/${student.id}/overview`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {student.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-sm sm:table-cell">
                      {student.studentNumber}
                    </TableCell>
                    <TableCell>{student.gradeLevel}</TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate md:table-cell">
                      {student.classLabel}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {student.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
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
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Students"
        description="Live directory from Supabase (RLS applies). Teachers only see learners in their assigned classes; leadership and registrar see the full roster."
        actions={
          canManageStudents(role) ? (
            <Button asChild>
              <Link href={`/dashboard/${role}/students/new`}>Add student</Link>
            </Button>
          ) : null
        }
      />

      <Suspense fallback={<StudentsDirectoryLoading />} key={searchQuery ?? ""}>
        <StudentsDirectoryResults role={role} searchQuery={searchQuery} />
      </Suspense>
    </div>
  );
}
