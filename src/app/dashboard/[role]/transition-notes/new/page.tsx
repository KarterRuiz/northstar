import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isRole, type Role } from "@/config/roles";
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
import { loadStudentDirectory } from "@/features/students/student-directory-queries";
import { TransitionNoteForm } from "@/features/teacher/transition-notes/transition-note-form";
import { loadTransitionNoteForForm } from "@/features/teacher/transition-notes/actions";
import { Button } from "@/components/ui/button";
import { isStudentId } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "New transition note",
  description:
    "Structured handoff notes for teachers: strengths, needs, subject notes, and next steps.",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ studentId?: string; noteId?: string }>;
};

async function StudentPickerSection({ role }: { role: Role }) {
  const result = await loadStudentDirectory(undefined);
  if (!result.ok) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {result.message}
      </p>
    );
  }
  const rows = result.students.slice(0, 80);
  const hrefBase = `/dashboard/${role}/transition-notes/new`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a student</CardTitle>
        <CardDescription>
          Transition notes are stored per learner. Pick someone from your roster
          (active enrollments only).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No students matched. Open the directory to confirm enrollments.
          </p>
        ) : (
          <Table>
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
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.fullName}</TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-[14rem] truncate sm:table-cell">
                    {s.classLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`${hrefBase}?studentId=${encodeURIComponent(s.id)}`}
                      >
                        Compose
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link href={`/dashboard/${role}/students`}>Browse all students</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function NewTransitionNotePage({ params, searchParams }: PageProps) {
  const { role } = await params;
  if (!isRole(role) || role !== "teacher") notFound();

  const sp = await searchParams;
  const rawStudent = typeof sp.studentId === "string" ? sp.studentId : undefined;
  const rawNote = typeof sp.noteId === "string" ? sp.noteId : undefined;
  const studentId = rawStudent && isStudentId(rawStudent) ? rawStudent : undefined;
  const noteId = rawNote && isStudentId(rawNote) ? rawNote : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6 sm:p-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Teacher workspace
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              New transition note
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base">
              Drafts and submissions are saved to Supabase. After you submit, edits
              stay locked until an administrator or school leader reopens the note.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/${role}`}>Back to overview</Link>
          </Button>
        </div>
      </div>

      {!studentId ? (
        <StudentPickerSection role={role} />
      ) : (
        <ComposeSection studentId={studentId} noteId={noteId} />
      )}
    </div>
  );
}

async function ComposeSection({
  studentId,
  noteId,
}: {
  studentId: string;
  noteId?: string;
}) {
  const loaded = await loadTransitionNoteForForm({ studentId, noteId });
  if (!loaded.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not open composer</CardTitle>
          <CardDescription>{loaded.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/teacher/transition-notes/new">Pick another student</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TransitionNoteForm
      studentId={studentId}
      initialNoteId={loaded.noteId}
      initialValues={loaded.fields}
      editable={loaded.editable}
      lockedStatus={loaded.editable ? undefined : loaded.status}
    />
  );
}
